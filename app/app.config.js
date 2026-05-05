const fs = require('fs');
const path = require('path');

const baseConfig = require('./app.json');

const overridePath = path.join(__dirname, 'app.local.json');
let localOverride = {};
if (fs.existsSync(overridePath)) {
  localOverride = JSON.parse(fs.readFileSync(overridePath, 'utf8'));
}

const openAiApiKey = process.env.RENTZU_OPENAI_API_KEY || localOverride.openAiApiKey || '';

module.exports = {
  ...baseConfig,
  expo: {
    ...baseConfig.expo,
    extra: {
      ...(baseConfig.expo.extra || {}),
      ...(openAiApiKey ? { openAiApiKey } : {}),
    },
  },
};
