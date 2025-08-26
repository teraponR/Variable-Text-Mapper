const fs = require('fs');
const path = require('path');

// Read the source HTML and JS files
const htmlContent = fs.readFileSync('src/ui.html', 'utf8');
const jsContent = fs.readFileSync('src/ui.js', 'utf8');

// Replace the external script reference with inline script
const updatedHtml = htmlContent.replace(
  '<script src="ui.js"></script>',
  `<script>\n${jsContent}\n</script>`
);

// Write the combined HTML file to dist
fs.writeFileSync('dist/ui.html', updatedHtml);

console.log('✅ Built UI with inline JavaScript successfully!');

