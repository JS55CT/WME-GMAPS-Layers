// ==UserScript==
// @name         WME GMAPS Layers
// @namespace    https://github.com/JS55CT
// @version      2024.10.27.01
// @description  Adds GMAPS Layers (Roads and Traffic, Landscape, Transit, Water) layers as an overlay in Waze Map Editor
// @downloadURL  https://github.com/JS55CT/WME-GMAPS-Layers/raw/main/WME-GMAPS-LAYERS.js
// @updateURL    https://github.com/JS55CT/WME-GMAPS-Layers/raw/main/WME-GMAPS-LAYERS.js
// @license      MIT
// @match        https://*.waze.com/*/editor*
// @match        https://*.waze.com/editor
// @exclude      https://*.waze.com/user/editor*
// @grant        none
// @require      https://greasyfork.org/scripts/24851-wazewrap/code/WazeWrap.js
// ==/UserScript==

/* global W, OpenLayers, google, WazeWrap */

(function () {
    'use strict';

    const debugMode = false;
    const scriptMetadata = GM_info.script;
    const storageKey = "WMEGMAPSLayerState";

    function getStorageData() {
        return JSON.parse(localStorage.getItem(storageKey) ?? '{}');
    }

    function setStorageData(data) {
        localStorage.setItem(storageKey, JSON.stringify(data));
    }

    function setItem(key, value) {
        const data = getStorageData();
        data[key] = value;
        setStorageData(data);
    }

    function getItem(key, defaultValue = null) {
        const data = getStorageData();
        return data[key] ?? defaultValue;
    }

    let googleMap, trafficLayer, gmapsContainer;
    let layerActive = getItem('layerActive', 'false') === 'true';
    let syncChange = false;

    const uiElements = {
        toggleButton: null,
        layerCheckbox: null,
        checkboxChangeHandler: null
    };

    function updateUiAfterToggle() {
        if (debugMode) console.log('WME GMAPS Layers: updateUiAfterToggle() with value', layerActive);

        if (uiElements.toggleButton) {
            if (debugMode) console.log('WME GMAPS Layers: Updating toggle button state to', layerActive);
            uiElements.toggleButton.classList.toggle('active', layerActive);
        }

        if (uiElements.layerCheckbox) {
            syncChange = true;
            if (debugMode) console.log('WME GMAPS Layers: Updating layer checkbox state to', layerActive);
            uiElements.layerCheckbox.checked = layerActive;
            uiElements.layerCheckbox.value = layerActive ? "on" : "off";
            if (uiElements.checkboxChangeHandler) {
                if (debugMode) console.log('WME GMAPS Layers: Invoking checkboxChangeHandler with value', layerActive);
                uiElements.checkboxChangeHandler(layerActive);
            }
            syncChange = false;
        }

        if (gmapsContainer) {
            if (debugMode) console.log('WME GMAPS Layers: Updating gmapsContainer display to', layerActive ? "block" : "none");
            gmapsContainer.style.display = layerActive ? "block" : "none";
        }

        const layerMenuCheckbox = document.querySelector('#layer-switcher-item_gmaps_layers input');
        if (layerMenuCheckbox) {
            if (debugMode) console.log('WME GMAPS Layers: Updating layer menu checkbox state to', layerActive);
            layerMenuCheckbox.checked = layerActive;
        }
    }

    function toggleLayerState(newState = null) {
        if (!syncChange) {
            if (debugMode) console.log('WME GMAPS Layers: toggleLayerState called with newState:', newState);
            syncChange = true;
            layerActive = newState !== null ? newState : !layerActive;
            setItem('layerActive', layerActive.toString());
            updateUiAfterToggle();
            syncChange = false;
        }
    }

    function createScriptHeader() {
        const header = document.createElement('div');
        header.className = 'script-header';

        header.innerHTML = `
            <span class="script-name">${scriptMetadata.name}</span>
            <span class="script-version">v${scriptMetadata.version}</span>
        `;
        return header;
    }

    function createToggleSwitch() {
        const container = document.createElement('div');
        container.className = 'toggle-container';

        const toggle = document.createElement('div');
        toggle.className = `toggle-switch${layerActive ? ' active' : ''}`;
        toggle.addEventListener('click', () => {
            toggleLayerState();
        });

        const slider = document.createElement('div');
        slider.className = 'slider';
        toggle.appendChild(slider);

        container.append(toggle, Object.assign(document.createElement('label'), {
            textContent: 'Toggle Layers',
            className: 'setting-label'
        }));

        uiElements.toggleButton = toggle;
        return container;
    }

    function createFeatureCheckbox({ featureType, elementType = null, defaultChecked, label, description }) {
        const wrapper = document.createElement('div');
        const id = featureType.replace('.', '_') + (elementType ? '_' + elementType.replace('.', '_') : '');

        const savedState = getItem(id, defaultChecked ? 'true' : 'false');
        const isChecked = savedState === 'true';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'style-checkbox';
        checkbox.checked = isChecked;
        checkbox.id = id;
        checkbox.dataset.featureType = featureType;
        if (elementType) checkbox.dataset.elementType = elementType;
        checkbox.dataset.visibility = 'on';
        checkbox.addEventListener('change', (event) => {
            setItem(id, event.target.checked.toString());
            updateMapStyles();
            if (debugMode) console.log(`WME GMAPS Layers: ${event.target.dataset.featureType} visibility set to:`, event.target.checked);
        });

        wrapper.innerHTML = `
            <label class='setting-label' for='${id}'>${label}</label><br>
            <span class='description'>${description}</span>
        `;
        wrapper.prepend(checkbox);

        return wrapper;
    }

    function updateMapStyles() {
        const baseMapStyles = [
            { "featureType": "administrative", "stylers": [{ "visibility": "off" }] },
            { "featureType": "poi", "stylers": [{ "visibility": "off" }] },
            { "featureType": "road", "stylers": [{ "visibility": "off" }] },
            { "featureType": "transit", "stylers": [{ "visibility": "off" }] },
            { "featureType": "landscape", "stylers": [{ "visibility": "off" }] },
            { "featureType": "water", "stylers": [{ "visibility": "off" }] }
        ];

        const customStyles = Array.from(document.querySelectorAll('.style-checkbox'))
            .filter(checkbox => checkbox.checked)
            .map(checkbox => {
                const { featureType, elementType } = checkbox.dataset;
                return {
                    "featureType": featureType,
                    ...(elementType ? { "elementType": elementType } : {}),
                    "stylers": [{ "visibility": "on" }]
                };
            });

        googleMap.setOptions({ styles: [...baseMapStyles, ...customStyles] });
        refreshTrafficLayer();
        if (debugMode) console.log('WME GMAPS Layers: Map styles updated');
    }

    function refreshTrafficLayer() {
        const trafficCheckbox = document.querySelector('#road');
        if (trafficCheckbox && trafficCheckbox.checked) {
            trafficLayer.setMap(googleMap);
            if (debugMode) console.log('WME GMAPS Layers: Traffic layer displayed');
        } else {
            trafficLayer.setMap(null);
            if (debugMode) console.log('WME GMAPS Layers: Traffic layer hidden');
        }
        gmapsContainer.style.pointerEvents = 'none';
        if (gmapsContainer.firstElementChild) {
            gmapsContainer.firstElementChild.style.backgroundColor = 'rgb(229 227 223 / 0%)';
        }
    }

    function transformCoords() {
        const currentPosition = new OpenLayers.LonLat(W.map.getCenter().lon, W.map.getCenter().lat);
        currentPosition.transform(
            new OpenLayers.Projection('EPSG:900913'),
            new OpenLayers.Projection('EPSG:4326')
        );
        return currentPosition;
    }

    function syncMapPosition() {
        if (!googleMap || !W.map) return;

        const coordinates = transformCoords();
        googleMap.panTo(new google.maps.LatLng(coordinates.lat, coordinates.lon));
        googleMap.setZoom(W.map.getZoom());
        if (debugMode) console.log("WME GMAPS Layers: Maps synchronized - Google Maps is set to", coordinates.lat, coordinates.lon);
    }

    function initializeGMapsLayers() {
        const { tabLabel, tabPane } = W.userscripts.registerSidebarTab("GMaps in WME");
        tabLabel.innerText = 'GMAP';

        W.userscripts.waitForElementConnected(tabPane).then(() => {
            const settingsForm = document.createElement('form');
            settingsForm.className = 'settings-form';

            settingsForm.append(
                createScriptHeader(),
                createToggleSwitch(),
                ...[
                    { featureType: "road", defaultChecked: true, label: "Roads & Traffic", description: "" },
                    { featureType: "administrative.land_parcel", defaultChecked: false, label: "Land Parcels", description: "" },
                    { featureType: "landscape", defaultChecked: false, label: "General Landscape", description: "" },
                    { featureType: "poi", defaultChecked: false, label: "Points of Interest", description: "" },
                    { featureType: "transit", defaultChecked: false, label: "Public Transit Features", description: "" },
                    { featureType: "water", defaultChecked: false, label: "Water Bodies", description: "" },
                ].map(createFeatureCheckbox)
            );

            tabPane.appendChild(settingsForm);

            gmapsContainer = document.createElement('div');
            gmapsContainer.id = "gmapsContainer";
            gmapsContainer.style.position = 'absolute';
            gmapsContainer.style.top = '0';
            gmapsContainer.style.left = '0';
            gmapsContainer.style.right = '0';
            gmapsContainer.style.bottom = '0';
            W.map.olMap.getViewport().appendChild(gmapsContainer);

            const coordinates = transformCoords();

            const googleScript = Array.from(document.querySelectorAll('script')).find(script => script.src.includes('maps.googleapis.com'));
            if (googleScript) {
                const urlParams = new URL(googleScript.src);
                const apiKey = urlParams.searchParams.get('key');
                if (debugMode) console.log('WME GMAPS Layers: Detected Google Maps API Key:', apiKey);
            }

            googleMap = new google.maps.Map(gmapsContainer, {
                zoom: W.map.getZoom(),
                center: { lat: coordinates.lat, lng: coordinates.lon },
                disableDefaultUI: true,
            });

            google.maps.event.addListenerOnce(googleMap, 'tilesloaded', syncMapPosition);

            trafficLayer = new google.maps.TrafficLayer();
            updateMapStyles();

            WazeWrap.Events.register('moveend', null, syncMapPosition);
            WazeWrap.Events.register('zoomend', null, syncMapPosition);

            WazeWrap.Interface.AddLayerCheckbox(
                "display",
                "GMaps Layers",
                layerActive,
                function(checked) {
                    uiElements.layerCheckbox = document.querySelector('#layer-switcher-item_gmaps_layers');

                    uiElements.checkboxChangeHandler = toggleLayerState;
                    if (layerActive !== checked) {
                        toggleLayerState(checked);
                    }
                },
                null
            );

            new WazeWrap.Interface.Shortcut(
                'WMEGoogleMapsLayers',
                'Toggle GMaps Layers',
                'layers',
                'layersToggleWMEGoogleMapsLayers',
                "Alt+G",
                () => toggleLayerState(),
                null
            ).add();

            uiElements.layerCheckbox = document.querySelector('#layer-switcher-item_gmaps_layers');
            if (uiElements.layerCheckbox) {
                uiElements.layerCheckbox.checked = layerActive;
                uiElements.layerCheckbox.value = layerActive ? "on" : "off";
            }

            updateUiAfterToggle();

        }).catch(error => {
            console.error("WME GMAPS Layers: Initialization error:", error);
        });
    }

    if (W?.userscripts?.state?.isReady) {
        initializeGMapsLayers();
    } else {
        document.addEventListener('wme-ready', initializeGMapsLayers, { once: true });
    }

    const customStyles = document.createElement('style');
    customStyles.textContent = `
        .input-space {
            margin-right: 10px;
        }
        .description {
            display: block;
            font-size: 0.9em;
            color: #666;
            margin-left: 18px;
            margin-bottom: 1px;
        }
        .setting-label {
            font-family: Arial, sans-serif;
            font-weight: bold;
            font-size: 1.0em;
            color: #333;
            background-color: transparent;
            padding: 2px;
            border-radius: 5px;
            margin-bottom: 2px;
            display: inline-block;
        }
        .settings-form {
            margin: 5px;
            padding: 10px;
            background-color: transparent;
            border: 2px solid #ddd;
            border-radius: 10px;
            box-shadow: 2px 2px 10px rgba(0,0,0,0.1);
        }
        .script-header {
            text-align: center;
            margin-bottom: 10px;
        }
        .script-name {
            font-size: 1.0em;
            font-weight: bold;
            color: #222;
            display: block;
        }
        .script-version {
            font-size: 1em;
            color: #555;
            display: block;
        }
        .toggle-container {
            display: flex;
            align-items: center;
            margin-bottom: 10px;
        }
        .toggle-switch {
            position: relative;
            width: 50px;
            height: 20px;
            background: #ccc;
            border-radius: 20px;
            cursor: pointer;
            margin-right: 10px;
            transition: background 0.3s;
        }
        .toggle-switch.active {
            background: #4CAF50;
        }
        .toggle-switch .slider {
            position: absolute;
            width: 15px;
            height: 15px;
            background: white;
            border-radius: 50%;
            top: 2px;
            left: 2px;
            margin-top: 0px;
            transition: all 0.3s;
        }
        .toggle-switch.active .slider {
            left: 30px;
        }
        .toggle-switch:not(.active) .slider {
            left: 2px;
        }
    `;
    document.head.appendChild(customStyles);
})();