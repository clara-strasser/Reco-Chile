/** Public surface of the simulation layer. Import from `@/lib/simulation`. */
export {
  equivalenceView,
  singleOrderSensitivity,
  singleOrderVariant,
} from "./equivalence";
export {
  buildSimulationRequest,
  canSimulate,
  toWishItem,
  type SimulationInputs,
} from "./request";
export { useSimulation, type SimulationView } from "./use-simulation";
