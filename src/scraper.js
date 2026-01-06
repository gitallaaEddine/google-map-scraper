const puppeteer = require("puppeteer");

class BusinessScraper {
  constructor() {
    this.browser = null;
    this.results = [];
    this.delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // Global address patterns for USA, Europe, Middle East
    this.addressPatterns = [
      // USA patterns
      "St.",
      "Street",
      "Ave",
      "Avenue",
      "Blvd",
      "Boulevard",
      "Rd",
      "Road",
      "Dr",
      "Drive",
      "Ln",
      "Lane",
      "Way",
      "Ct",
      "Court",
      "Pl",
      "Place",
      "Pkwy",
      "Parkway",
      "Hwy",
      "Highway",
      "Suite",
      "Ste",
      "Apt",
      "Floor",
      // European patterns
      "Str.",
      "Straße",
      "Strasse",
      "Rue",
      "Via",
      "Calle",
      "Straat",
      "Gasse",
      "Platz",
      "Place",
      "Piazza",
      "Plaza",
      "Corso",
      "Viale",
      "Allee",
      "Weg",
      "Laan",
      "Gracht",
      "Kade",
      "Quai",
      "Promenade",
      // UK patterns
      "High Street",
      "Lane",
      "Close",
      "Gardens",
      "Terrace",
      "Crescent",
      "Grove",
      // Middle East patterns
      "شارع",
      "طريق",
      "Street",
      "Road",
      "Tower",
      "Building",
      "Block",
      // General patterns
      "No.",
      "Nr.",
      "#",
      "Unit",
    ];

    // International phone patterns
    this.phonePatterns = [
      /\+1[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}/, // USA: +1 (123) 456-7890
      /\(\d{3}\)\s?\d{3}[\s-]?\d{4}/, // USA: (123) 456-7890
      /\+33[\s-]?\d[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2}/, // France: +33 1 23 45 67 89
      /\+49[\s-]?\d{2,4}[\s-]?\d{3,8}/, // Germany: +49 30 12345678
      /\+44[\s-]?\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}/, // UK: +44 20 1234 5678
      /\+39[\s-]?\d{2,3}[\s-]?\d{3,4}[\s-]?\d{3,4}/, // Italy: +39 02 1234 5678
      /\+34[\s-]?\d{2,3}[\s-]?\d{3}[\s-]?\d{3}/, // Spain: +34 91 123 456
      /\+31[\s-]?\d{1,2}[\s-]?\d{3}[\s-]?\d{4}/, // Netherlands: +31 20 123 4567
      /\+971[\s-]?\d[\s-]?\d{3}[\s-]?\d{4}/, // UAE: +971 4 123 4567
      /\+966[\s-]?\d[\s-]?\d{3}[\s-]?\d{4}/, // Saudi Arabia: +966 1 234 5678
      /\+974[\s-]?\d{4}[\s-]?\d{4}/, // Qatar: +974 1234 5678
      /\+973[\s-]?\d{4}[\s-]?\d{4}/, // Bahrain: +973 1234 5678
      /\+965[\s-]?\d{4}[\s-]?\d{4}/, // Kuwait: +965 1234 5678
      /\+968[\s-]?\d{4}[\s-]?\d{4}/, // Oman: +968 1234 5678
      /\d{3}[\s-]\d{3}[\s-]\d{4}/, // Generic: 123-456-7890
      /\d{2,4}[\s-]\d{3,4}[\s-]\d{3,4}/, // Generic international
    ];

    // Website domain patterns for target markets
    this.websiteDomains = [
      // USA
      ".com",
      ".us",
      ".org",
      ".net",
      ".co",
      // Europe
      ".eu",
      ".uk",
      ".co.uk",
      ".de",
      ".fr",
      ".it",
      ".es",
      ".nl",
      ".be",
      ".ch",
      ".at",
      ".pl",
      ".pt",
      ".ie",
      ".se",
      ".no",
      ".dk",
      ".fi",
      // Middle East
      ".ae",
      ".sa",
      ".qa",
      ".kw",
      ".bh",
      ".om",
      ".jo",
      ".lb",
      ".eg",
    ];
  }

  async init() {
    this.browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--lang=en-US"],
    });
    console.log("Browser initialized for global scraping");
  }

  async scrapeGoogleMaps(searchQuery, maxResults = 50) {
    if (!this.browser) await this.init();

    const page = await this.browser.newPage();

    // Set English language for consistent scraping
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
    });

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    try {
      // Use English Google Maps for consistent parsing
      const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(
        searchQuery
      )}?hl=en`;
      console.log(`Searching: ${searchUrl}`);

      await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 60000 });
      await this.delay(3000);

      // Scroll untuk load lebih banyak results
      await this.scrollResults(page, maxResults);

      // Debug: Get page structure info
      const debugInfo = await page.evaluate(() => {
        const info = {
          jsactionElements: document.querySelectorAll("[jsaction]").length,
          roleElements: document.querySelectorAll("[role]").length,
          dataValueElements: document.querySelectorAll("[data-value]").length,
          clickableElements: document.querySelectorAll(
            '[jsaction*="pane"], [jsaction*="place"], [jsaction*="rating"]'
          ).length,
          allDivs: document.querySelectorAll("div").length,
          allSpans: document.querySelectorAll("span").length,
          allAs: document.querySelectorAll("a").length,
          bodyTextLength: document.body.textContent.length,
          title: document.title,
          wrapper: document.querySelectorAll(".TFQHme ").length,
        };

        // Get first 500 chars of body text for analysis
        info.bodyTextPreview = document.body.textContent.substring(0, 500);

        return info;
      });

      console.log("=== DEBUG: Page Structure Analysis ===");
      console.log(`Title: ${debugInfo.title}`);
      console.log(`Elements with jsaction: ${debugInfo.jsactionElements}`);
      console.log(`Elements with role: ${debugInfo.roleElements}`);
      console.log(`Elements with data-value: ${debugInfo.dataValueElements}`);
      console.log(
        `Clickable business elements: ${debugInfo.clickableElements}`
      );
      console.log(`Total divs: ${debugInfo.allDivs}`);
      console.log(`Total spans: ${debugInfo.allSpans}`);
      console.log(`Total links: ${debugInfo.allAs}`);
      console.log(`Body text length: ${debugInfo.bodyTextLength}`);
      console.log("Body text preview:");
      console.log(debugInfo.bodyTextPreview);
      console.log({ wrapper: debugInfo.wrapper });

      // Extract business data directly from the list without clicking
      const businesses = await page.evaluate(
        (addressPatterns, websiteDomains) => {
          const results = [];

          // Method 1: Look for business cards using TFQHme separators
          const separators = document.querySelectorAll(".TFQHme");
          console.log(`Found ${separators.length} TFQHme separators`);

          for (let i = 0; i < separators.length; i++) {
            const separator = separators[i];
            const nextDiv = separator.nextElementSibling;

            if (nextDiv) {
              const businessCard = nextDiv.querySelector(".Nv2PK");
              if (businessCard) {
                // Extract business name
                const nameElement = businessCard.querySelector(
                  ".qBF1Pd.fontHeadlineSmall"
                );
                const name = nameElement ? nameElement.textContent.trim() : "";

                // Extract address - look for span with address patterns (global)
                let address = "";
                const allSpans = businessCard.querySelectorAll("span");
                for (const span of allSpans) {
                  const text = span.textContent.trim();
                  const hasAddressPattern = addressPatterns.some((pattern) =>
                    text.includes(pattern)
                  );
                  const hasNumbers = /\d/.test(text);
                  const hasComma = text.includes(",");

                  if (
                    hasAddressPattern ||
                    (hasNumbers && text.length > 10 && hasComma)
                  ) {
                    address = text.replace(/^[·•]\s*/, "");
                    break;
                  }
                }

                // Extract phone - look for span with international phone patterns
                let phone = "";
                for (const span of allSpans) {
                  const text = span.textContent.trim();
                  // Match various international phone formats
                  const phoneRegexes = [
                    /\+\d{1,3}[\s-]?\(?\d{1,4}\)?[\s-]?\d{2,4}[\s-]?\d{2,4}[\s-]?\d{0,4}/, // International format
                    /\(\d{3}\)\s?\d{3}[\s-]?\d{4}/, // US format (123) 456-7890
                    /\d{3}[\s.-]\d{3}[\s.-]\d{4}/, // US format 123-456-7890
                    /\d{2,4}[\s-]\d{3,4}[\s-]\d{3,4}/, // European format
                    /\d{8,15}/, // Long number string
                  ];

                  for (const regex of phoneRegexes) {
                    if (
                      regex.test(text) &&
                      text.length >= 8 &&
                      text.length <= 25
                    ) {
                      phone = text;
                      break;
                    }
                  }
                  if (phone) break;
                }

                // Extract rating
                let rating = "";
                const ratingElement = businessCard.querySelector(".MW4etd");
                if (ratingElement) {
                  rating = ratingElement.textContent.trim();
                }

                // Extract website - look for website link specifically (global domains)
                let website = "";
                let referenceLink = "";
                const websiteLinks = businessCard.querySelectorAll("a");
                for (const link of websiteLinks) {
                  const href = link.href;
                  const text = link.textContent.trim();

                  // Look for Google Maps reference link
                  if (href && href.includes("google.com/maps")) {
                    referenceLink = href;
                  }

                  // Look for website links that are not Google Maps links (check global domains)
                  const hasValidDomain = websiteDomains.some(
                    (domain) => href && href.includes(domain)
                  );
                  if (
                    href &&
                    !href.includes("google.com/maps") &&
                    !href.includes("maps.google.com") &&
                    hasValidDomain &&
                    (text.toLowerCase().includes("website") ||
                      text.toLowerCase().includes("site") ||
                      text.includes("www") ||
                      href.includes("http"))
                  ) {
                    website = href;
                  }
                }

                if (name && address) {
                  results.push({
                    name,
                    address,
                    phone,
                    rating,
                    website,
                    referenceLink,
                    hasWebsite: !!website,
                  });
                  console.log(`Extracted: ${name} - ${address} - ${phone}`);
                }
              }
            }
          }

          // Method 2: If no results from separators, try direct business card selection
          if (results.length === 0) {
            const businessCards = document.querySelectorAll(".Nv2PK");
            console.log(
              `Found ${businessCards.length} business cards directly`
            );

            for (let i = 0; i < businessCards.length; i++) {
              const card = businessCards[i];

              // Extract business name
              const nameElement = card.querySelector(
                ".qBF1Pd.fontHeadlineSmall"
              );
              const name = nameElement ? nameElement.textContent.trim() : "";

              // Extract address (global patterns)
              let address = "";
              const allSpans = card.querySelectorAll("span");
              for (const span of allSpans) {
                const text = span.textContent.trim();
                const hasAddressPattern = addressPatterns.some((pattern) =>
                  text.includes(pattern)
                );
                const hasNumbers = /\d/.test(text);
                const hasComma = text.includes(",");

                if (
                  hasAddressPattern ||
                  (hasNumbers && text.length > 10 && hasComma)
                ) {
                  address = text.replace(/^[·•]\s*/, "");
                  break;
                }
              }

              // Extract phone (international formats)
              let phone = "";
              for (const span of allSpans) {
                const text = span.textContent.trim();
                const phoneRegexes = [
                  /\+\d{1,3}[\s-]?\(?\d{1,4}\)?[\s-]?\d{2,4}[\s-]?\d{2,4}[\s-]?\d{0,4}/,
                  /\(\d{3}\)\s?\d{3}[\s-]?\d{4}/,
                  /\d{3}[\s.-]\d{3}[\s.-]\d{4}/,
                  /\d{2,4}[\s-]\d{3,4}[\s-]\d{3,4}/,
                  /\d{8,15}/,
                ];

                for (const regex of phoneRegexes) {
                  if (
                    regex.test(text) &&
                    text.length >= 8 &&
                    text.length <= 25
                  ) {
                    phone = text;
                    break;
                  }
                }
                if (phone) break;
              }

              // Extract rating
              let rating = "";
              const ratingElement = card.querySelector(".MW4etd");
              if (ratingElement) {
                rating = ratingElement.textContent.trim();
              }

              // Extract website (global domains)
              let website = "";
              let referenceLink = "";
              const websiteLinks = card.querySelectorAll("a");
              for (const link of websiteLinks) {
                const href = link.href;
                const text = link.textContent.trim();

                if (href && href.includes("google.com/maps")) {
                  referenceLink = href;
                }

                const hasValidDomain = websiteDomains.some(
                  (domain) => href && href.includes(domain)
                );
                if (
                  href &&
                  !href.includes("google.com/maps") &&
                  !href.includes("maps.google.com") &&
                  hasValidDomain &&
                  (text.toLowerCase().includes("website") ||
                    text.toLowerCase().includes("site") ||
                    text.includes("www") ||
                    href.includes("http"))
                ) {
                  website = href;
                }
              }

              if (name && address) {
                results.push({
                  name,
                  address,
                  phone,
                  rating,
                  website,
                  referenceLink,
                  hasWebsite: !!website,
                });
                console.log(`Extracted: ${name} - ${address} - ${phone}`);
              }
            }
          }

          console.log(`Total extracted: ${results.length} businesses`);
          return results;
        },
        this.addressPatterns,
        this.websiteDomains
      );

      console.log(`Successfully extracted ${businesses.length} businesses`);

      this.results = [...this.results, ...businesses];
      return businesses;

      await page.close();
      return businesses;
    } catch (error) {
      console.error("Error scraping Google Maps:", error);
      await page.close();
      return [];
    }
  }

  async scrollResults(page, maxResults = 20) {
    console.log(`Scrolling to load more results (target: ${maxResults})...`);

    try {
      // Try multiple scroll containers
      const scrollSelectors = [
        '[role="feed"]',
        ".m6QErb.DxyBCb.kA9KIf.dS8AEf.XiKgde.ecceSd",
        '[role="main"]',
        ".section-layout",
        ".section-scrollbox",
        ".scrollable-y",
        '[data-role="region"]',
      ];

      let scrollContainer = null;
      for (const selector of scrollSelectors) {
        scrollContainer = await page.$(selector);
        if (scrollContainer) {
          console.log(`Found scroll container: ${selector}`);
          break;
        }
      }

      if (!scrollContainer) {
        console.log("No scroll container found, trying alternative method");
        // Try scrolling the page itself
        for (let i = 0; i < 10; i++) {
          await page.evaluate(() => {
            window.scrollBy(0, 1000);
          });
          await this.delay(2000);
          console.log(`Page scroll ${i + 1}/10`);
        }
        return;
      }

      // Scroll until we reach maxResults or can't load more
      let previousCount = 0;
      let noChangeCount = 0;
      const maxScrollAttempts = 50; // Prevent infinite scrolling

      for (let i = 0; i < maxScrollAttempts; i++) {
        await page.evaluate((container) => {
          container.scrollTop = container.scrollHeight;
        }, scrollContainer);

        await this.delay(2000);

        // Check current results count
        const resultCount = await page.evaluate(() => {
          return document.querySelectorAll(".TFQHme").length;
        });

        console.log(
          `Scroll ${
            i + 1
          }/${maxScrollAttempts} - Current results: ${resultCount}`
        );

        // If we've reached target, stop
        if (resultCount >= maxResults) {
          console.log(
            `Reached target of ${maxResults} results (actual: ${resultCount}), stopping scroll`
          );
          break;
        }

        // If no new results after 3 attempts, stop
        if (resultCount === previousCount) {
          noChangeCount++;
          if (noChangeCount >= 3) {
            console.log(
              `No new results after ${noChangeCount} attempts, stopping scroll`
            );
            break;
          }
        } else {
          noChangeCount = 0;
        }

        previousCount = resultCount;
      }
    } catch (error) {
      console.log("Scroll completed with minor issues:", error.message);
    }
  }

  async scrapeYellowPages(searchQuery, location = "New York") {
    if (!this.browser) await this.init();

    const page = await this.browser.newPage();

    try {
      // Use Yelp for US/global business directory
      const searchUrl = `https://www.yelp.com/search?find_desc=${encodeURIComponent(
        searchQuery
      )}&find_loc=${encodeURIComponent(location)}`;
      console.log(`Searching Yelp: ${searchUrl}`);

      await page.goto(searchUrl, { waitUntil: "networkidle2" });
      await this.delay(2000);

      const businesses = await page.evaluate(() => {
        const results = [];
        const businessElements = document.querySelectorAll(
          ".listing-item, .business-item"
        );

        businessElements.forEach((element) => {
          const nameElement = element.querySelector(
            "h3, .business-name, .listing-name"
          );
          const addressElement = element.querySelector(
            ".address, .business-address"
          );
          const phoneElement = element.querySelector(".phone, .business-phone");

          const business = {
            name: nameElement?.textContent?.trim() || "",
            address: addressElement?.textContent?.trim() || "",
            phone: phoneElement?.textContent?.trim() || "",
            source: "YellowPages",
          };

          if (business.name && business.address) {
            results.push(business);
          }
        });

        return results;
      });

      console.log(`Found ${businesses.length} businesses from Yelp`);
      this.results = [...this.results, ...businesses];

      await page.close();
      return businesses;
    } catch (error) {
      console.error("Error scraping Yelp:", error);
      await page.close();
      return [];
    }
  }

  cleanPhoneNumber(phone) {
    if (!phone) return "";

    // Keep international format, just clean up
    return phone
      .replace(/[^\d+\-\s()]/g, "") // Keep digits, +, -, spaces, parentheses
      .replace(/\s+/g, " ") // Normalize spaces
      .trim();
  }

  formatToInternational(phone) {
    if (!phone) return "";

    let cleaned = phone.replace(/\D/g, "");

    // Detect country and format
    const countryPrefixes = {
      1: "+1", // USA/Canada
      44: "+44", // UK
      33: "+33", // France
      49: "+49", // Germany
      39: "+39", // Italy
      34: "+34", // Spain
      31: "+31", // Netherlands
      32: "+32", // Belgium
      41: "+41", // Switzerland
      43: "+43", // Austria
      971: "+971", // UAE
      966: "+966", // Saudi Arabia
      974: "+974", // Qatar
      973: "+973", // Bahrain
      965: "+965", // Kuwait
      968: "+968", // Oman
    };

    // If already has country code
    for (const [code, prefix] of Object.entries(countryPrefixes)) {
      if (cleaned.startsWith(code)) {
        return prefix + " " + cleaned.substring(code.length);
      }
    }

    // Return cleaned number if no country code detected
    return phone;
  }

  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Email generation skipped for now
  async findEmails(businessName, location) {
    return []; // Skip email generation for now
  }

  async processResults() {
    console.log("Processing and cleaning results...");

    const processedResults = await Promise.all(
      this.results.map(async (business, index) => {
        const cleanPhone = this.cleanPhoneNumber(business.phone);
        const possibleEmails = await this.findEmails(
          business.name,
          business.address
        );

        return {
          id: index + 1,
          name: business.name,
          address: business.address,
          phone: cleanPhone,
          website: business.website || "",
          referenceLink: business.referenceLink || "",
          possibleEmails: possibleEmails,
          rating: business.rating || "N/A",
          source: business.source || "Google Maps",
          scrapedAt: new Date().toISOString(),
        };
      })
    );

    // Remove duplicates based on name and address
    const uniqueResults = processedResults.filter(
      (business, index, self) =>
        index ===
        self.findIndex(
          (b) =>
            b.name.toLowerCase() === business.name.toLowerCase() &&
            b.address.toLowerCase() === business.address.toLowerCase()
        )
    );

    console.log(`Processed ${uniqueResults.length} unique businesses`);
    return uniqueResults;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log("Browser closed");
    }
  }
}

module.exports = BusinessScraper;
