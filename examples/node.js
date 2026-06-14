// Minimal Node example.  Usage:  node examples/node.js <product_id> <license_key>
const { verifyGumroadLicense } = require('../src/index.js');

const [productId, licenseKey] = process.argv.slice(2);
if (!productId || !licenseKey) {
  console.error('usage: node examples/node.js <product_id> <license_key>');
  process.exit(1);
}

verifyGumroadLicense({ productId, licenseKey }).then((result) => {
  if (result.valid) {
    console.log(`✓ valid — licensed to ${result.email} (uses: ${result.uses})`);
  } else {
    console.log(`✗ not valid — ${result.reason}`);
  }
});
