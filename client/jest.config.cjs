module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/setupTests.js'],
  transform: {
    '^.+\\.jsx?$': 'babel-jest'
  },
  extensionsToTreatAsEsm: ['.jsx'],
  transformIgnorePatterns: [
    'node_modules/(?!react-leaflet|@react-leaflet|leaflet)'
  ],
  moduleNameMapper: {
    '^react$': 'react',
    '^react-dom$': 'react-dom',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
  }
};
