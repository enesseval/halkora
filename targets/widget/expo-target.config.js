// @bacons/apple-targets config for the home-screen widget (docs/ROADMAP.md
// "iOS Widget"). Shows today's most actionable ring + a one-tap check-in
// (see HalkoraWidget.swift + app/widget-checkin/[id].tsx for the check-in
// side, src/lib/widget.ts for what the main app writes into the shared App
// Group). App Group id mirrors app.json's ios.entitlements — same value in
// both places, or the widget reads an empty/wrong shared container.
/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'HalkoraWidget',
  deploymentTarget: '17.0',
  frameworks: ['SwiftUI', 'WidgetKit'],
  colors: {
    $accent: '#FF6B47',
    $widgetBackground: '#0D0E11',
  },
  entitlements: {
    'com.apple.security.application-groups':
      config.ios.entitlements['com.apple.security.application-groups'],
  },
});
