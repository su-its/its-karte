import { resetAndSeed } from "./seed";

export default async function globalSetup() {
  await resetAndSeed();
}
