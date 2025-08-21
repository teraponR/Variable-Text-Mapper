
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Environment variables for configuration
const FIGMA_TOKEN = process.env.FIGMA_TOKEN;

// Get all variables from a Figma file
app.get('/api/figma/files/:fileKey/variables', async (req, res) => {
  try {
    const { fileKey } = req.params;
    
    if (!FIGMA_TOKEN) {
      return res.status(400).json({ error: 'Figma token not configured' });
    }

    const response = await fetch(`https://api.figma.com/v1/files/${fileKey}/variables`, {
      headers: {
        'Authorization': `Bearer ${FIGMA_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Figma API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Transform the data to match our plugin's expected format
    const transformedVariables = [];
    
    if (data.meta && data.meta.variables) {
      for (const [variableId, variable] of Object.entries(data.meta.variables)) {
        // Get collection name
        let collectionName = 'Unknown';
        if (data.meta.variableCollections && variable.variableCollectionId) {
          const collection = data.meta.variableCollections[variable.variableCollectionId];
          collectionName = collection ? collection.name : 'Unknown';
        }

        // Get first mode value
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
            const color = variableValue;
            value = `rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)})`;
          } else if (variableValue && typeof variableValue === 'object' && 'id' in variableValue) {
            // Variable alias
            const aliasVariable = data.meta.variables[variableValue.id];
            value = aliasVariable ? `→ ${aliasVariable.name}` : 'Alias';
          }
        }

        transformedVariables.push({
          id: variableId,
          name: variable.name,
          value: value,
          type: variable.resolvedType,
          collection: collectionName
        });
      }
    }

    res.json({ variables: transformedVariables });
  } catch (error) {
    console.error('Error fetching Figma variables:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get specific variable details
app.get('/api/figma/variables/:variableId', async (req, res) => {
  try {
    const { variableId } = req.params;
    
    if (!FIGMA_TOKEN) {
      return res.status(400).json({ error: 'Figma token not configured' });
    }

    const response = await fetch(`https://api.figma.com/v1/variables/${variableId}`, {
      headers: {
        'Authorization': `Bearer ${FIGMA_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Figma API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching Figma variable:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Figma API proxy server running on port ${PORT}`);
  console.log(`Make sure to set FIGMA_TOKEN environment variable`);
});
