// Vehicle definitions shared by the physics sim and the renderer.
export const VEHICLES = {
  roadster: {
    id: 'roadster', name: 'Volt Roadster', icon: '🏎️', blurb: 'Featherweight electric hypercar. Brutal acceleration, battery thrusters.',
    mass: 1650, half: [0.95, 0.28, 2.15], com: [0, -0.18, 0.05], inertia: [3000, 3400, 800], roof: { half: [0.72, 0.22, 1.0], at: [0, 0.5, -0.15] },
    wheelPos: [[0.86, -0.02, 1.38], [-0.86, -0.02, 1.38], [0.88, -0.02, -1.36], [-0.88, -0.02, -1.36]], rest: 0.34, radius: 0.36, travel: 0.32,
    mul: { accel: 1, vmax: 1, grip: 1, steer: 1 }, tough: 1, rcs: false, groundY: -0.72,
  },
  hauler: {
    id: 'hauler', name: 'Volt Ferrox', icon: '🛻', blurb: 'Angular stainless-steel electric pickup. Heavy, tough and grippy, with cold-gas RCS jets for air control, hover hops and soft landings.',
    mass: 2900, half: [1.0, 0.4, 2.6], com: [0, -0.22, 0], inertia: [7800, 8600, 2300], roof: { half: [0.92, 0.3, 1.15], at: [0, 0.68, 0.05] },
    wheelPos: [[0.9, -0.02, 1.75], [-0.9, -0.02, 1.75], [0.9, -0.02, -1.75], [-0.9, -0.02, -1.75]], rest: 0.40, radius: 0.44, travel: 0.4,
    mul: { accel: 0.74, vmax: 0.9, grip: 1.28, steer: 0.88 }, tough: 1.8, brakeDecel: 8.6, reverseVmax: 7.5, rcs: true, groundY: -0.86, price: { coins: 6000 },
  },
};
export const vehicleOf = id => VEHICLES[id] || VEHICLES.roadster;
