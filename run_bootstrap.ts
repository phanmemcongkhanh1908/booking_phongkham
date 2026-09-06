import { bootstrapSystem } from "./server/core/bootstrap.js";
bootstrapSystem().then(() => console.log("Bootstrap complete")).catch(e => console.error(e));
