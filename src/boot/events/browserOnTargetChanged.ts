import path from "path";
import { Browser, Target } from "puppeteer";
import { eventEmitter } from "../../scrape";
import { searchForImport } from "./search-for-import";

export const browserOnTargetChangedHandler = (_browser: Browser) => async (target: Target) => {
  const page = await target.page();
  if (!page) {
    return;
  }
  try {
    await page.waitForNavigation({ waitUntil: "networkidle2" });
  } catch (error) {
    eventEmitter.emit("logicfailed", error);
  }

  const scrapeCompletedCallback = new Promise((resolve, reject) => {
    eventEmitter.emit("logicloaded", logicLoadedCallback(target, reject, resolve));
  });

  eventEmitter.emit("scrapecomplete", scrapeCompletedCallback);
};

function logicLoadedCallback(target: Target, reject, resolve) {
  return async (browser: Browser) => {
    const url = target.url();
    let importing = url.split("://").pop();
    if (!importing) {
      throw new Error("Page URL parse error");
    }
    importing = path.resolve(process.cwd(), "dist", "pages", importing); // initialize

    const logic = await searchForImport(importing as string)
      // ERROR HANDLE
      .catch((error) => {
        eventEmitter.emit("logicfailed", error);
        return async (error) => {
          reject(error);
          throw error;
        };
      });
    // ERROR HANDLE
    const results = logic(browser, target);
    return resolve(results);
  };
}
