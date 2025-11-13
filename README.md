# Fireflies - CS174A Project

## Team Members
- Aneesh Ratnala (aneeshratnala@ucla.edu, 106490501)
- Sanjay Dhamodharan (sanjayd@g.ucla.edu, 106380244)
- Andrew Meng (andrewm17us@gmail.com, 406424798)

## Project Description
An interactive 3D simulation of 100 fireflies in a mason jar using the Boids algorithm for swarm behavior. Users can interact with the swarm by clicking to "poke" it, and can open the jar to release the fireflies.

## Setup Instructions

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser to the URL shown (typically `http://localhost:5173/`)

## Controls

- **Mouse**: Move camera around the scene
- **Click**: Poke the swarm - fireflies will react and move away from the click point
- **Spacebar**: Open/close the jar lid
- **R**: Reset the simulation (fireflies return to jar)

## Features Implemented

### Initial Demo Features
- ✅ 100 fireflies rendered using individual meshes (can be optimized to instanced rendering)
- ✅ Mason jar modeled using Three.js geometry
- ✅ Boids algorithm prototype (separation, alignment, cohesion)
- ✅ Mouse/keyboard navigation functional
- ✅ Phong shading for materials
- ✅ Basic interactivity (poke, open jar, reset)

### Advanced Features (Prototype)
- ✅ **AI Algorithm**: Boids swarm behavior implemented
- 🔄 **Bump Mapping**: To be implemented for ground texture
- 🔄 **Shadowing**: Basic shadow setup, to be enhanced with firefly light shadows

## Project Structure

```
Project/
├── index.html          # Main HTML file
├── main.js            # Main application code
├── package.json       # Dependencies
└── README.md          # This file
```

## Next Steps

1. **Modeling**: Create/load mason jar OBJ model using Blender/Maya
2. **Instanced Rendering**: Optimize firefly rendering using instanced meshes
3. **Bump Mapping**: Add normal maps for ground texture
4. **Enhanced Shadowing**: Implement shadows cast by firefly lights
5. **Visual Polish**: Improve firefly glow effect, jar transparency, lighting

## Technical Details

### Boids Algorithm
The swarm behavior is controlled by three main forces:
- **Separation**: Fireflies avoid crowding neighbors
- **Alignment**: Fireflies steer towards average heading of neighbors
- **Cohesion**: Fireflies move toward average position of neighbors

### Jar Boundary
Fireflies are constrained within the jar boundaries when the jar is closed. When opened, they can escape and disperse.

## Notes
- Uses Three.js for 3D graphics
- OBJ loader is set up and ready for custom jar models
- All code follows WebGL/Three.js best practices

