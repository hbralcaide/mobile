module.exports = {
  preset: 'react-native',
  // Avoid scanning unrelated folders (like an empty server/package.json)
  // which can cause jest-haste-map JSON parse errors.
  modulePathIgnorePatterns: ['<rootDir>/server/'],
  // Transform some node_modules packages (ESM or modern syntax) so Jest can parse them
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|@react-navigation/native)/)'
  ],
};
