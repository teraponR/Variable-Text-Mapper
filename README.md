# Variable Mapper

A Figma plugin for mapping and transforming variable text in selected text nodes.

## Features

- Map multiple variable values to new values
- Apply transformations to selected text nodes
- Modern, intuitive UI
- Real-time feedback and error handling

## Project Structure

```
variable-text-mapper/
│── manifest.json      # Plugin manifest
│── package.json       # Dependencies and scripts
│── tsconfig.json      # TypeScript configuration
│── src/
│    ├── code.js       # Main plugin logic
│    ├── ui.html       # UI panel
│    └── ui.js         # UI script (postMessage)
│── dist/
│    ├── code.js       # Build output
│    └── ui.js         # Build output
```

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the plugin:
   ```bash
   npm run build
   ```

3. For development with auto-rebuild:
   ```bash
   npm run dev
   ```

## Usage

1. Select text nodes in Figma
2. Run the plugin
3. Add variable mappings (old value → new value)
4. Click "Apply Mappings" to transform the text

## Development

- `src/code.ts` - Main plugin logic that handles Figma API interactions
- `src/ui.html` - UI interface with modern styling
- `src/ui.ts` - UI logic for handling user interactions and communication with the plugin

## Building

The TypeScript files are compiled to JavaScript in the `dist/` directory. The build process:
- Compiles TypeScript to JavaScript
- Outputs to `dist/code.js` and `dist/ui.js`
- Maintains compatibility with Figma's plugin system

## License

MIT
