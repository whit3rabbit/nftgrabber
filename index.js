const puppeteer = require("puppeteer");
const fs = require("fs/promises");
const path = require("path");
const url = process.argv[2];
const saveStatePath = "./save-state.json";

if (!url) {
  console.log(`Please enter a URL (e.g. "npm start https://rarible.com/boredapeyachtclub").`);
  return;
}

(async () => {
  console.log("Loading...");
  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(url);
    await page.setViewport({
      width: 1200,
      height: 800,
    });

    await page.waitForSelector(".ReactVirtualized__Grid");

    const pageTitle = await page.title();
    const collection = pageTitle.split("-").shift().trim().split(" ").slice(0, 3).join("-")
      .replace(/[^a-zA-Z0-9-]/g, "");
    const collectionDir = path.join(__dirname, collection);
    await fs.mkdir(collectionDir, { recursive: true });

    let currentImage = 1;
    let lastSavedPosition = null;

	try {
	  await fs.access(saveStatePath);
	  const saveState = JSON.parse(await fs.readFile(saveStatePath));
	  if (saveState.collection === collection) {
		console.log(`Found previous state for ${collection}. Resuming...`);
		currentImage = saveState.currentImage;
		lastSavedPosition = saveState.lastSavedPosition;
	  }
	} catch (error) {
	  if (error.code !== "ENOENT") {
		console.error(`Error accessing ${saveStatePath}`, error);
	  }
	}

    page.on("response", async (response) => {
      const imageUrl = response.url();
      if (response.request().resourceType() === "image") {
        if (imageUrl.includes("t_image_preview")) {
          try {
            const fileName = imageUrl.split("/").pop() + ".avif";
            const filePath = path.join(collectionDir, fileName);
            const file = await response.buffer();
            await fs.writeFile(filePath, file);
            console.log(`${collection} #${currentImage} saved to ${collection}/${fileName}`);
            currentImage++;

            if (currentImage % 20 === 0) {
              const saveState = {
                collection,
                currentImage,
                lastSavedPosition,
              };
              await fs.writeFile(saveStatePath, JSON.stringify(saveState));
              console.log(`Saved state for ${collection}`);
            }
          } catch (error) {
            console.error(`Error saving ${imageUrl}`, error);
          }
        }
      }
    });

    if (lastSavedPosition) {
      console.log("Scrolling to last saved position");
      await autoScroll(page, lastSavedPosition);
    }

    await page.evaluate(() => {
      const elements = [...document.querySelectorAll("button")];
      const targetElement = elements.find((e) => e.innerText.includes("Load more"));
      targetElement && targetElement.click();
    });

    lastSavedPosition = await autoScroll(page, lastSavedPosition);

    const saveState = {
      collection,
      currentImage,
      lastSavedPosition,
    };
    await fs.writeFile(saveStatePath, JSON.stringify(saveState));
    console.log(`Saved final state for ${collection}.`);

    await browser.close();
  } catch (error) {
    console.error("Error:", error);
  }
})();

async function autoScroll(page, lastSavedPosition) {
  await page.evaluate(async (lastSavedPosition) => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      let distance = 500;
      let timer = setInterval(() => {
        let scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        } else if (totalHeight >= lastSavedPosition) {
          clearInterval(timer);
          resolve();
        }
      }, 1000);
    });
  }, lastSavedPosition);
}
