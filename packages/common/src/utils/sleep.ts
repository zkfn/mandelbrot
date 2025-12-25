export const sleep = async (millis: number) => {
  await new Promise((resolve) => setTimeout(resolve, millis));
};
