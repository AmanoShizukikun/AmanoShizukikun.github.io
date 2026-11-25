// Her poses, in body space (room/rig.js): +Y up, +Z the way she faces, +X her left. A pose is a function of the time
// since it began (t) that returns
//   aim    bone → the direction it should point (towards its child joint); left side +X outward, right side −X
//   rot    bone → [x, y, z, angle] turns added on top (or a list of them)
//   pivot  { y: pelvis height, z / x: shift, tilt: [x, y, z, angle] } — sitting lowers it, lying tips it over
//   skirt  0…1 how far the skirt lifts over the thighs          face   an expression for the time of the pose
//   noLook true when she should not turn her head to look at things
// Heights are relative to the surface she is on (`at` below); the agent adds that surface's height.
const { sin, cos, max, PI } = Math;
const L = (v) => v, R = ([x, y, z]) => [-x, y, z];           // mirror an aim from her left side to her right
const pair = (name, v) => ({ [`${name}_l`]: L(v), [`${name}_r`]: R(v) });
// a direction turned about her left–right axis (positive = the far end goes backwards)
const pitch = ([x, y, z], a) => [x, y * cos(a) - z * sin(a), y * sin(a) + z * cos(a)];
const breathe = (t, k = 1) => ({ spine_03: [1, 0, 0, 0.018 * k * sin(t * 1.7)], clavicle_l: [0, 0, 1, 0.01 * k * sin(t * 1.7)], clavicle_r: [0, 0, 1, -0.01 * k * sin(t * 1.7)] });

// the maid's way of standing: hands together in front, at the apron
const STAND_ARMS = { ...pair('upperarm', [0.16, -1, 0.22]), ...pair('lowerarm', [-0.62, -0.42, 0.66]), ...pair('hand', [-0.7, -0.45, 0.4]) };
const SIT_LEGS = { ...pair('thigh', [0.09, -0.1, 1]), ...pair('calf', [0.03, -1, 0.1]), ...pair('foot', [0, -0.35, 1]) };
const SEAT = 0.1;                                             // pelvis joint above what she sits on

export const poses = {
  stand: (t) => ({
    aim: { ...STAND_ARMS },
    rot: { ...breathe(t), spine_01: [0, 1, 0, 0.03 * sin(t * 0.4)] },
    pivot: { x: 0.008 * sin(t * 0.5) },
  }),

  // walking: `cadence` steps per second comes from the agent through t (it passes the walked distance)
  walk: (t, _, phase = t * 2 * PI * 0.9) => {
    const s = sin(phase), legs = {};
    for (const [side, ph] of [['l', phase], ['r', phase + PI]]) {
      const a = 0.42 * sin(ph), bend = 0.1 + 0.85 * max(0, -sin(ph - 0.7));
      const thigh = [side === 'l' ? 0.03 : -0.03, -cos(a), sin(a)];
      legs[`thigh_${side}`] = thigh;
      legs[`calf_${side}`] = pitch(thigh, bend);
      legs[`foot_${side}`] = pitch([0, -0.3, 1], bend * 0.4 - a * 0.5);
    }
    return {
      aim: {
        ...legs,
        upperarm_l: [0.13, -1, -0.32 * s], upperarm_r: [-0.13, -1, 0.32 * s],
        lowerarm_l: pitch([0.1, -1, -0.32 * s], -0.35), lowerarm_r: pitch([-0.1, -1, 0.32 * s], -0.35),
      },
      rot: { spine_01: [0, 1, 0, 0.07 * s], spine_03: [0, 1, 0, -0.05 * s] },
      pivot: { y: undefined, dy: -0.022 * (1 - cos(2 * phase)) / 2, x: 0.012 * s },
    };
  },

  sit: (t) => ({
    aim: { ...SIT_LEGS, ...pair('upperarm', [0.13, -0.85, 0.5]), ...pair('lowerarm', [-0.2, -0.35, 1]), ...pair('hand', [-0.15, -0.5, 1]) },
    rot: { ...breathe(t), spine_02: [1, 0, 0, 0.05] },
    pivot: { y: SEAT, z: 0.02 }, skirt: 1,
  }),

  type: (t) => ({
    aim: {
      ...SIT_LEGS,
      ...pair('upperarm', [0.24, -0.55, 0.8]), ...pair('lowerarm', [-0.22, -0.08, 1]),
      hand_l: [-0.1, -0.25 + 0.12 * max(0, sin(t * 13)), 1], hand_r: [0.1, -0.25 + 0.12 * max(0, sin(t * 11 + 1.3)), 1],
    },
    rot: { ...breathe(t), spine_02: [1, 0, 0, 0.12], head: [1, 0, 0, 0.12] },
    pivot: { y: SEAT, z: 0.02 }, skirt: 1,
  }),

  write: (t) => ({
    aim: {
      ...SIT_LEGS,
      upperarm_l: [0.26, -0.6, 0.75], lowerarm_l: [-0.45, -0.15, 0.9], hand_l: [-0.5, -0.3, 0.8],
      upperarm_r: [-0.22, -0.55, 0.8], lowerarm_r: [0.18 + 0.05 * sin(t * 6), -0.28, 1], hand_r: [0.1, -0.5 + 0.08 * cos(t * 6), 1],
    },
    rot: { ...breathe(t), spine_02: [1, 0, 0, 0.16], head: [[1, 0, 0, 0.32], [0, 0, 1, 0.08]] },
    pivot: { y: SEAT, z: 0.02 }, skirt: 1, noLook: true,
  }),

  read: (t) => ({
    aim: { ...SIT_LEGS, ...pair('upperarm', [0.2, -0.75, 0.6]), ...pair('lowerarm', [-0.42, 0.32, 0.85]), ...pair('hand', [-0.3, 0.55, 0.75]) },
    rot: { ...breathe(t), spine_02: [1, 0, 0, 0.08], head: [[1, 0, 0, 0.38 + 0.03 * sin(t * 0.5)], [0, 1, 0, 0.06 * sin(t * 0.23)]] },
    pivot: { y: SEAT, z: 0.02 }, skirt: 1, noLook: true,
  }),

  hug: (t) => ({
    aim: { ...SIT_LEGS, ...pair('upperarm', [0.3, -0.5, 0.8]), ...pair('lowerarm', [-0.85, 0.05, 0.45]), ...pair('hand', [-0.8, 0.2, 0.2]) },
    rot: { ...breathe(t), head: [[0, 0, 1, 0.14 * sin(t * 1.1)], [1, 0, 0, 0.1]] },
    pivot: { y: SEAT, z: 0.02, tilt: [0, 0, 1, 0.07 * sin(t * 1.1)] }, skirt: 1,
  }),

  // sitting on her heels (on the bed, facing the window)
  kneel: (t) => ({
    aim: {
      ...pair('thigh', [0.12, -0.28, 1]), ...pair('calf', [0.02, -0.12, -1]), ...pair('foot', [0, 0.1, -1]),
      ...pair('upperarm', [0.14, -0.85, 0.45]), ...pair('lowerarm', [-0.12, -0.55, 0.85]),
    },
    rot: { ...breathe(t), head: [[1, 0, 0, -0.12], [0, 1, 0, 0.18 * sin(t * 0.21)]] },
    pivot: { y: 0.33 }, skirt: 0.8, noLook: true,
  }),

  // on her back: the pivot tips her over so that her face points up (+Z becomes +Y, her head goes to −Z)
  lie: (t) => ({
    aim: { ...pair('upperarm', [0.2, -1, 0.05]), ...pair('lowerarm', [0.1, -1, 0.18]), ...pair('thigh', [0.05, -1, 0.05]), ...pair('calf', [0.02, -1, -0.03]) },
    rot: { spine_03: [1, 0, 0, 0.012 * sin(t * 0.9)], head: [0, 1, 0, 0.32] },
    // a negative skirt folds the skirt in towards her legs instead of lifting it
    pivot: { y: 0.11, tilt: [1, 0, 0, -PI / 2] }, skirt: -0.35, face: 'sleep', noLook: true,
  }),

  stretch: (t) => {
    const s = sin(t * 1.25);
    return {
      aim: { ...pair('upperarm', [0.22, 1, 0.06]), ...pair('lowerarm', [0.04, 1, 0.02]) },
      rot: { spine_02: [0, 0, 1, 0.2 * s], spine_03: [0, 0, 1, 0.08 * s], head: [1, 0, 0, -0.15] },
      pivot: { y: undefined, dy: 0.012 * (1 + cos(t * 2.5)), x: -0.02 * s },
    };
  },

  tidy: (t) => {
    const s = sin(t * 2.2);
    return {
      aim: {
        upperarm_l: [0.25, -0.1 + 0.25 * s, 1], lowerarm_l: [0.05, 0.3 + 0.2 * s, 1],
        upperarm_r: [-0.25, -0.1 - 0.25 * s, 1], lowerarm_r: [-0.05, 0.3 - 0.2 * s, 1],
      },
      rot: { ...breathe(t), spine_01: [0, 1, 0, 0.12 * sin(t * 0.7)], head: [1, 0, 0, -0.05] },
    };
  },

  wave: (t) => ({
    aim: {
      upperarm_l: [0.15, -1, 0.15], lowerarm_l: [-0.3, -0.7, 0.6],
      upperarm_r: [-0.85, 0.5, 0.25], lowerarm_r: [-0.15 + 0.4 * sin(t * 9), 1, 0.2], hand_r: [-0.1 + 0.4 * sin(t * 9), 1, 0.3],
    },
    rot: { ...breathe(t), head: [0, 0, 1, -0.12] },
    face: 'joy',
  }),

  pat: (t) => ({
    aim: { ...STAND_ARMS },
    rot: { ...breathe(t), head: [[1, 0, 0, 0.28], [0, 0, 1, 0.16 * sin(t * 1.4)]], spine_03: [1, 0, 0, 0.06] },
    pivot: { tilt: [0, 0, 1, 0.03 * sin(t * 1.4)] }, face: 'bliss', noLook: true,
  }),

  talk: (t) => ({
    aim: {
      ...pair('upperarm', [0.16, -1, 0.22]), lowerarm_l: [-0.62, -0.42, 0.66], hand_l: [-0.7, -0.45, 0.4],
      upperarm_r: [-0.25, -0.7, 0.55], lowerarm_r: [0.15 + 0.12 * sin(t * 2.3), 0.15 + 0.15 * sin(t * 1.7), 1],
    },
    rot: { ...breathe(t), head: [0, 0, 1, 0.08 * sin(t * 0.9)] },
  }),
};
