/// <reference types="@figma/plugin-typings" />

// code.js
figma.showUI(__html__, {
  width: 400,
  height: 600,
  themeColors: true,
  visible: true
});

// ✅ ให้ผู้ใช้ลาก resize หน้าต่าง plugin ได้
figma.ui.onmessage = (msg) => {
  if (msg.type === 'resize') {
    const { width, height } = msg.size;
    figma.ui.resize(width, height);
  }
};

// Send available variables to UI when plugin starts
async function loadVariables() {
  try {
    const localVariables = figma.variables.getLocalVariables();
    const variablesData = [];
    
    for (const variable of localVariables) {
      try {
        // Get variable collection
        const collection = figma.variables.getVariableCollectionById(variable.variableCollectionId);
        
        // Get the first available value from the variable
        let value = 'N/A';
        if (variable.valuesByMode && Object.keys(variable.valuesByMode).length > 0) {
          const firstModeId = Object.keys(variable.valuesByMode)[0];
          const variableValue = variable.valuesByMode[firstModeId];
          
          if (typeof variableValue === 'string') {
            value = variableValue;
          } else if (typeof variableValue === 'number') {
            value = variableValue.toString();
          } else if (variableValue && typeof variableValue === 'object' && 'r' in variableValue) {
            // Color value
            const color = variableValue as RGB;
            value = `rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)})`;
          } else if (variableValue && typeof variableValue === 'object' && 'id' in variableValue) {
            // Variable alias
            const aliasVariable = figma.variables.getVariableById(variableValue.id);
            value = aliasVariable ? `→ ${aliasVariable.name}` : 'Alias';
          }
        }
        
        variablesData.push({
          id: variable.id,
          name: variable.name,
          value: value,
          type: variable.resolvedType,
          collection: collection?.name || 'Unknown',
          source: 'local'
        });
      } catch (error) {
        // Skip variables that can't be processed
        console.warn('Error processing variable:', variable.name, error);
      }
    }
    
    figma.ui.postMessage({
      type: 'variables-loaded',
      variables: variablesData
    });
  } catch (error) {
    figma.ui.postMessage({
      type: 'variables-loaded',
      variables: []
    });
  }
}

// Load external variables from Figma API
async function loadExternalVariables(fileKey: string) {
  try {
    figma.ui.postMessage({
      type: 'external-variables-loading'
    });

    // This would be the URL of your proxy server
    const fileKey = 'qjOoV9vk0GCv0a9Hy90xMW';
    const proxyUrl = 'https://e2aa82b9d47b.ngrok-free.app'; // Update this to your server URL
    console.log("Sending request to proxy...");
    const response = await fetch(`${proxyUrl}/api/figma/files/${fileKey}/variables`);
    
    console.log("Response status:", response.status);


    if (!response.ok) {
      throw new Error(`Failed to fetch variables: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Mark external variables with source
    const externalVariables = data.variables.map((variable: any) => ({
      ...variable,
      source: 'external',
      id: `external_${variable.id}` // Prefix to distinguish from local variables
    }));
    
    figma.ui.postMessage({
      type: 'external-variables-loaded',
      variables: externalVariables
    });
  } catch (error) {
    figma.ui.postMessage({
      type: 'external-variables-error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

// Check current selection and send to UI
function checkCurrentSelection() {
  const textNodes = figma.currentPage.selection.filter(
    node => node.type === 'TEXT'
  ) as TextNode[];
  
  if (textNodes.length > 0) {
    const textNode = textNodes[0];
    const selectedText = textNode.characters;
    
    // Check if text node has bound variables
    const boundVariables = textNode.boundVariables;
    let boundVariableInfo = null;
    
    if (boundVariables && boundVariables.characters) {
      const variableId = boundVariables.characters;
      const variable = figma.variables.getVariableById(typeof variableId === 'string' ? variableId : variableId.id);
      
      if (variable) {
        // Get variable collection
        const collection = figma.variables.getVariableCollectionById(variable.variableCollectionId);
        
        // Get current value
        let currentValue = 'N/A';
        if (variable.valuesByMode && Object.keys(variable.valuesByMode).length > 0) {
          const firstModeId = Object.keys(variable.valuesByMode)[0];
          const variableValue = variable.valuesByMode[firstModeId];
          
          if (typeof variableValue === 'string') {
            currentValue = variableValue;
          } else if (typeof variableValue === 'number') {
            currentValue = variableValue.toString();
          } else if (variableValue && typeof variableValue === 'object' && 'r' in variableValue) {
            const color = variableValue as RGB;
            currentValue = `rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)})`;
          }
        }
        
        boundVariableInfo = {
          id: variable.id,
          name: variable.name,
          value: currentValue,
          collection: collection?.name || 'Unknown'
        };
      }
    }
    
    figma.ui.postMessage({
      type: 'text-selected',
      text: selectedText,
      nodeName: textNode.name,
      nodeId: textNode.id,
      boundVariable: boundVariableInfo
    });
  } else {
    figma.ui.postMessage({
      type: 'no-text-selected'
    });
  }
}

// Load variables and check selection on startup
loadVariables();
checkCurrentSelection();

// Keep UI in sync when the user changes selection in the canvas
figma.on('selectionchange', () => {
  checkCurrentSelection();
});

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'load-external-variables') {
    const { fileKey } = msg;
    await loadExternalVariables(fileKey);
  }
  
  if (msg.type === 'map-variables') {
    try {
      const { variableMappings } = msg;
      
      // Get all text nodes in the current selection
      const textNodes = figma.currentPage.selection.filter(
        node => node.type === 'TEXT'
      ) as TextNode[];
      
      if (textNodes.length === 0) {
        figma.ui.postMessage({
          type: 'error',
          message: 'No text nodes selected. Please select at least one text node.'
        });
        return;
      }
      
      // Debug: Send info about selected text nodes
      console.log('Selected text nodes:', textNodes.map(node => ({
        name: node.name,
        characters: node.characters
      })));
      
      // Apply variable mappings to each text node
      for (const textNode of textNodes) {
        await figma.loadFontAsync(textNode.fontName as FontName);
        
        let newText = textNode.characters;
        
        // Apply each mapping
        for (const oldValue in variableMappings) {
          if (variableMappings.hasOwnProperty(oldValue)) {
            const newValue = variableMappings[oldValue];
            newText = newText.replace(new RegExp(oldValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(newValue));
          }
        }
        
        textNode.characters = newText;
      }
      
      figma.ui.postMessage({
        type: 'success',
        message: `Updated ${textNodes.length} text node(s)`
      });
      
    } catch (error) {
      figma.ui.postMessage({
        type: 'error',
        message: `Error: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
  
  if (msg.type === 'bind-variable') {
    try {
      const { variableId } = msg;
      
      // Get the variable
      const variable = figma.variables.getVariableById(variableId);
      if (!variable) {
        figma.ui.postMessage({
          type: 'error',
          message: 'Variable not found.'
        });
        return;
      }
      // Get all currently selected text nodes
      const textNodes = figma.currentPage.selection.filter(
        node => node.type === 'TEXT'
      ) as TextNode[];

      if (textNodes.length === 0) {
        figma.ui.postMessage({
          type: 'error',
          message: 'Please select at least one text node in the canvas.'
        });
        return;
      }

      // Bind the variable to each selected text node
      for (const textNode of textNodes) {
        await figma.loadFontAsync(textNode.fontName as FontName);
        textNode.setBoundVariable('characters', variableId);
      }

      // Get variable details for display
      const collection = figma.variables.getVariableCollectionById(variable.variableCollectionId);
      const collectionName = collection ? collection.name : 'Unknown';
      const variablePath = `${collectionName}/${variable.name}`;
      
      // Get current value
      let currentValue = 'N/A';
      if (variable.valuesByMode && Object.keys(variable.valuesByMode).length > 0) {
        const firstModeId = Object.keys(variable.valuesByMode)[0];
        const variableValue = variable.valuesByMode[firstModeId];
        
        if (typeof variableValue === 'string') {
          currentValue = variableValue;
        } else if (typeof variableValue === 'number') {
          currentValue = variableValue.toString();
        } else if (variableValue && typeof variableValue === 'object' && 'r' in variableValue) {
          const color = variableValue as RGB;
          currentValue = `rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)})`;
        }
      }
      
      figma.ui.postMessage({
        type: 'variable-bound',
        message: `Successfully bound variable to ${textNodes.length} text node(s).`,
        variableDetails: {
          name: variablePath,
          value: currentValue,
          type: variable.resolvedType
        }
      });
      
    } catch (error) {
      figma.ui.postMessage({
        type: 'error',
        message: `Error binding variable: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
  
  if (msg.type === 'cancel') {
    figma.closePlugin();
  }
};
