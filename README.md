# WME GMAPS Layers

![License](https://img.shields.io/badge/license-MIT-blue.svg)

## Overview

**WME GMAPS Layers** is a user script designed for the Waze Map Editor (WME) that allows users to overlay GMAPS layers (Roads and Traffic, Landscape, Transit, Water) on top of the Waze map to enhance their mapping experience.

## Features

- Toggle visibility of GMAPS layers within WME.
- Synchronize GMAPS position and zoom level with WME.
- Customize which GMAPS features to display (Roads, Landscape, Transit, Water, Administrative Land Parcels, Points of Interest).
- Integrated with WazeWrap for adding settings to the sidebar and keyboard shortcuts.

## Installation

To install this user script, you need to have a userscript manager installed in your browser (such as Tampermonkey or Greasemonkey).

### Tampermonkey (Recommended)

1. **Install Tampermonkey**:
   - [Tampermonkey for Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - [Tampermonkey for Firefox](https://addons.mozilla.org/firefox/addon/tampermonkey/)
   - [Other browsers](https://www.tampermonkey.net/)

2. **Add the Script via URL**:
   - **Open the Tampermonkey dashboard** by clicking on the Tampermonkey icon in your browser toolbar and selecting "Dashboard".
   - In the dashboard, click on the tab that says "Utilities".
   - In the "Import from URL" section, paste the following URL:

     ``` https://raw.githubusercontent.com/JS55CT/WME-GMAPS-Layers/main/WME-GMAPS-LAYERS.js ```

   - Click on the "Import" button.
   - You will be directed to a page that shows the script. Click the "Install" button.

### Greasemonkey

1. **Install Greasemonkey**:
   - [Greasemonkey for Firefox](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/)

2. [Click here to install WME GMAPS Layers](https://raw.githubusercontent.com/JS55CT/WME-GMAPS-Layers/main/WME-GMAPS-LAYERS.js)

## Usage

Once installed, follow these steps to use the user script within the Waze Map Editor:

1. Open the Waze Map Editor.
2. Wait for the user script to initialize.
3. Open the "GMAP" tab in the WME sidebar.
4. Use the provided settings form to enable or disable GMAPS layers and customize which features are displayed.

### Settings

The script provides several configuration options directly within the WME interface.

- **Enable/Disable GMAPS Layers:** Toggle the visibility of the GMAPS overlay.
- **Customize Layers:** Choose which specific GMAPS features to display:
  - Roads
  - Traffic
  - Administrative Land Parcels
  - General Landscape
  - Points of Interest
  - Public Transit Features
  - Water Bodies
- **Customize May Style:**
  - Standered
  - Dark / Night
  - Silver
  - Retro
  - Aubergine

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgements

- Thanks to WazeWrap for providing a robust interface to integrate with WME.
- Inspired by the need for better integration between GMAPS and Waze for enhanced map editing capabilities.

---

**Note:** This script comes with no warranty or guarantee. Use it at your own risk. Please adhere to GMAPS and Waze terms of service while using this script.
