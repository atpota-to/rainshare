// How the landing's garden is fitted into the part of the backdrop the page keeps clear for
// it. The scene (./garden-scene.js) sets its camera by this, and the page (./garden.js) uses
// the same sums to know where the horizon will be before the scene has been fetched, so the
// pitch can stand on it from the start. Nothing here needs three.js.

// Where the camera stands: in front of the row's middle, at about the height of a grown plant.
export const EYE = [.35, 3, 15.2];
// How far to each side of the row's middle a frame takes in, and the height the camera looks
// at. `close` is for a frame as wide as the page, on a phone, where the row is drawn as big
// as it'll go.
export const FRAME = { wide: { reach: 6.1, aim: 2.55 }, close: { reach: 5.35, aim: 3.1 } };
// How much of a frame's height the garden needs: from under the plots' labels (UNDER, below
// the ground, and BASE pixels for the label itself) to over your cloud (OVER, and TOP pixels
// for what's written over it).
export const UNDER = .45, OVER = 6.35, BASE = 26, TOP = 50;

/**
 * Fit the garden into `frame`: { x, y, w, h } in CSS pixels from the canvas's top left, and
 * `close` (see FRAME). The plots' labels sit along the frame's lower edge, and your cloud
 * and what's written over it fit under its top. What comes back, in the same pixels:
 *   unit        how many pixels a unit of the scene covers, where the row is
 *   lens        how far from the picture the eye is: unit times how far the row is
 *   midX, midY  where the point the camera looks at is drawn
 *   horizon     how far down the horizon is
 *   aim         the height the camera looks at
 */
export function fit(frame){
  const { reach, aim } = FRAME[frame.close ? 'close' : 'wide'];
  const unit = Math.min(120, Math.max(16, Math.min(frame.w / (2 * reach), (frame.h - TOP - BASE) / (OVER + UNDER))));
  const midY = frame.y + frame.h - BASE - (aim + UNDER) * unit;
  // The horizon is level with the eye, which is a little over (or under) what it looks at.
  return { unit, lens: unit * EYE[2], midX: frame.x + frame.w / 2, midY, horizon: midY - (EYE[1] - aim) * unit, aim };
}
