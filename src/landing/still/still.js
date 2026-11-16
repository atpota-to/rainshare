// Made by scripts/still.mjs (npm run still): how each of the landing's stills was framed,
// in its own pixels. `unit` is how many a unit of the scene covers, `midX` and `midY` where
// the point the camera looks at is, and the rest where the labels go, as the scene's
// onFrame gives them (src/landing/garden-scene.js): under each plot, your cloud (its middle,
// width and height), over the friend's cloud, and how much of the time to the reset is left.
export const STILLS = {
  "wide": {
    "w": 2448,
    "h": 2592,
    "unit": 72,
    "midX": 1656,
    "midY": 1584,
    "plots": [ 1676.8, 1692.2, 1590.6, 1782.2, 1767.2, 1789.8, 1937.7, 1783.1 ],
    "cloud": [ 1429.4, 1382.5, 228, 136 ],
    "friend": [ 1675.7, 1438.3 ],
    "left": 0.66
  },
  "close": {
    "w": 1075,
    "h": 3936,
    "unit": 96,
    "midX": 537.6,
    "midY": 2496,
    "plots": [ 565.5, 2693.8, 449.8, 2815.2, 686.9, 2825.5, 915.9, 2816.4 ],
    "cloud": [ 237.3, 2281.6, 302.2, 180.3 ],
    "friend": [ 563.8, 2355.3 ],
    "left": 0.66
  }
};
