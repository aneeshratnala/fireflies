# Fireflies - CS174A Project

## Team Members
- Aneesh Ratnala, Sanjay Dhamodharan, Andrew Meng

## Project Description & Theme
Our project animates one hundred glowing fireflies coming out of a mason jar. When the user clicks on the fireflies, the swarm moves together and separates as one unit, able to part and reform automatically. Thus, the fireflies are not moving randomly, but as a cohesive swarm.
Our "story" is driven by two key user interactions:
Probing: When the user's cursor "pokes" the glass, the swarm reacts as a single organism. It will recoil from the point of contact, part to let the "finger" through, and then slowly reform its pattern once the cursor moves away.
Release: When the user presses the spacebar, the jar's lid animates, unscrewing and opening. This triggers a change in the fireflies' AI, causing them to spill out of the jar and disperse into the background, leaving the jar empty.
The example on the left (from https://ercang.github.io/boids-js/) depicts what we are trying to accomplish. As seen, there are multiple “swarms” of moving objects (the small prisms) that move independently but within the confines of their greater swarm. 

The AI-generated image to the right (from Gemini) depicts, on the more artistic side, inspiration for what we want our project to look like. Inspired by natural themes, our graphics will likely not be as intricate, but our functionality will be intact.


## Setup Instructions

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser to the localhost URL shown.

## Controls

- **Mouse**: Move camera around the scene
- **Click**: Poke the swarm - fireflies will react and move away from the click point
- **Spacebar**: Open/close the jar lid
- **R**: Reset the simulation (fireflies return to jar)

## Features Implemented

### Topics from Course
We plan to implement features employing the following topics from the course:
perspective projection,
matrices for transforming and viewing,
Phong shading for the firefly glow and the surface of the jar,
smooth shading (interpolation),
texture mapping & normal mapping for frost on the jar, and
instanced rendering (all boids drawn in one draw call)


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

