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

## Topics from Course
We plan to implement features employing the following topics from the course:
perspective projection,
matrices for transforming and viewing,
Phong shading for the firefly glow and the surface of the jar,
smooth shading (interpolation),
texture mapping & normal mapping for frost on the jar, and
instanced rendering (all boids drawn in one draw call)


## Advanced Features (Prototype)
Our two key advanced features are bump maps, AI algorithms, and shadowing.

We will use bump maps to create the texture of the ground, creating a grayscale texture and generating a corresponding normal map. We will pass the normal map to the fragment shader and modify the interpolated surface normal using the sampled normal map vector. This will be combined with Phong shading to produce variations in response to light, allowing for fewer polygons, but still conveying texture detail. 
 
We will also utilize the Boids algorithm (an advanced AI algorithm) to simulate swarm motion for each firefly. Fireflies will steer away from nearby fireflies, match velocity with the average heading of nearby boids, and steer towards the center of mass of the local swarm. 

Further, we will implement shadowing by using light from the fireflies to cast shadows on objects outside of the jar, which involves rendering a depth map from the light's perspective and then comparing it to the camera's view to determine which points lie in shadow. The AI-generated image to the right shows how, in general, lighting from inside the jar affects shadowing outside the jar. This is what we intend to replicate in our graphics.


## Project Structure

```
Project/
├── index.html          # Main HTML file
├── main.js            # Main application code
├── package.json       # Dependencies
└── README.md          # This file
```
