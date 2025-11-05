((PLUGIN_ID: string) => {
  "use strict";
  const CONFIG = kintone.plugin.app.getConfig(PLUGIN_ID);

  // Parse selected fields from config
  const selectedFieldObjects = CONFIG.selectedFieldObjects ? JSON.parse(CONFIG.selectedFieldObjects) : [];

  // Create autocomplete dropdown
  const createAutocomplete = (inputElement: HTMLInputElement, fieldConfig: any) => {
    let dropdown: HTMLDivElement | null = null;
    let debounceTimer: number | null = null;
    let allRecords: any[] = []; // Store all records
    let selectedIndex: number = -1; // Track selected item index
    let currentItems: HTMLDivElement[] = []; // Store current dropdown items

    const removeDropdown = () => {
      if (dropdown && dropdown.parentNode) {
        dropdown.parentNode.removeChild(dropdown);
        dropdown = null;
      }
      selectedIndex = -1;
      currentItems = [];
    };

    // Highlight selected item
    const highlightItem = (index: number) => {
      // Remove highlight from all items
      currentItems.forEach((item) => {
        item.style.backgroundColor = "white";
      });

      // Highlight selected item
      if (index >= 0 && index < currentItems.length) {
        currentItems[index].style.backgroundColor = "#e8f4ff";
        // Scroll into view if needed
        currentItems[index].scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    };

    // Select item by index
    const selectItem = (index: number) => {
      if (index >= 0 && index < currentItems.length) {
        currentItems[index].click();
      }
    };

    // Load all records from related app with pagination
    const loadAllRecords = async () => {
      try {
        const relatedAppId = fieldConfig.lookup.relatedApp.app;
        let offset = 0;
        const limit = 500;
        let hasMore = true;
        const records: any[] = [];

        // Fetch records in batches
        while (hasMore) {
          const resp = await kintone.api(kintone.api.url("/k/v1/records", true), "GET", {
            app: relatedAppId,
            query: `order by $id desc limit ${limit} offset ${offset}`
          });

          records.push(...resp.records);

          // Check if there are more records
          if (resp.records.length < limit) {
            hasMore = false;
          } else {
            offset += limit;
          }

          // Safety limit to prevent infinite loop (max 10,000 records)
          if (offset >= 10000) {
            hasMore = false;
          }
        }

        allRecords = records;
      } catch (error) {
        console.error("Error loading records from related app:", error);
      }
    };

    // Helper function to get searchable string from field value
    const getSearchableValue = (fieldValue: any): string => {
      if (!fieldValue) return '';

      if (typeof fieldValue === 'string' || typeof fieldValue === 'number') {
        return String(fieldValue);
      }

      if (Array.isArray(fieldValue)) {
        // Handle multi-select fields (USER_SELECT, ORGANIZATION_SELECT, etc.)
        return fieldValue.map((item: any) => {
          if (typeof item === 'object') {
            // Prefer name over code for better display
            return item.name || item.code || JSON.stringify(item);
          }
          return String(item);
        }).join(', ');
      }

      if (typeof fieldValue === 'object') {
        // Handle single USER_SELECT, ORGANIZATION_SELECT, GROUP_SELECT
        if (fieldValue.name) {
          return fieldValue.name;
        }
        if (fieldValue.code) {
          return fieldValue.code;
        }
        // Handle other object types
        return JSON.stringify(fieldValue);
      }

      return '';
    };

    // Client-side search in loaded records
    const searchRecords = (query: string) => {
      if (!query || query.length < 1) {
        removeDropdown();
        return;
      }

      const lookupPickerFields = fieldConfig.lookup.lookupPickerFields || [];
      const relatedKeyField = fieldConfig.lookup.relatedKeyField;

      // Filter records that match the query
      const filteredRecords = allRecords.filter((record: any) => {
        // Search in lookupPickerFields
        for (const fieldCode of lookupPickerFields) {
          if (record[fieldCode] && record[fieldCode].value) {
            const searchableValue = getSearchableValue(record[fieldCode].value).toLowerCase();
            if (searchableValue.includes(query.toLowerCase())) {
              return true;
            }
          }
        }

        // Also search in relatedKeyField
        if (record[relatedKeyField] && record[relatedKeyField].value) {
          const searchableValue = getSearchableValue(record[relatedKeyField].value).toLowerCase();
          if (searchableValue.includes(query.toLowerCase())) {
            return true;
          }
        }

        return false;
      }).slice(0, 10); // Limit to 10 results

      showDropdown(filteredRecords, inputElement, fieldConfig);
    };

    // Load all records when autocomplete is created
    loadAllRecords();

    const showDropdown = (records: any[], input: HTMLInputElement, fieldConfig: any) => {
      removeDropdown();

      dropdown = document.createElement("div");
      dropdown.style.position = "absolute";
      dropdown.style.backgroundColor = "white";
      dropdown.style.border = "1px solid #ccc";
      dropdown.style.maxHeight = "300px";
      dropdown.style.overflowY = "auto";
      dropdown.style.zIndex = "10000";
      dropdown.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
      dropdown.style.minWidth = input.offsetWidth + "px";
      dropdown.style.maxWidth = "600px";
      dropdown.style.width = "auto";

      const rect = input.getBoundingClientRect();
      dropdown.style.left = rect.left + window.scrollX + "px";
      dropdown.style.top = rect.bottom + window.scrollY + "px";

      if (records.length === 0) {
        // Show "No data found" message
        const noDataItem = document.createElement("div");
        noDataItem.style.padding = "8px 12px";
        noDataItem.style.color = "#999";
        noDataItem.style.fontStyle = "italic";
        noDataItem.textContent = "No data found";
        dropdown.appendChild(noDataItem);
        document.body.appendChild(dropdown);
        return;
      }

      // Reset selection
      selectedIndex = -1;
      currentItems = [];

      records.forEach((record: any) => {
        const item = document.createElement("div");
        item.style.padding = "8px 12px";
        item.style.cursor = "pointer";
        item.style.borderBottom = "1px solid #f0f0f0";
        item.style.whiteSpace = "nowrap";
        item.style.overflow = "visible";

        // Build display text from lookupPickerFields
        const displayParts: string[] = [];
        fieldConfig.lookup.lookupPickerFields.forEach((fieldCode: string) => {
          if (record[fieldCode] && record[fieldCode].value) {
            const displayValue = getSearchableValue(record[fieldCode].value);
            if (displayValue) {
              displayParts.push(displayValue);
            }
          }
        });

        item.textContent = displayParts.join(" | ");

        item.addEventListener("mouseenter", () => {
          item.style.backgroundColor = "#f5f5f5";
        });

        item.addEventListener("mouseleave", () => {
          item.style.backgroundColor = "white";
        });

        item.addEventListener("click", () => {
          const keyValue = record[fieldConfig.lookup.relatedKeyField].value;
          input.value = keyValue;

          // Trigger change event to activate kintone's lookup
          const changeEvent = new Event("change", { bubbles: true });
          input.dispatchEvent(changeEvent);

          // Give kintone time to process the change, then trigger Enter
          setTimeout(() => {
            const enterEvent = new KeyboardEvent("keydown", {
              key: "Enter",
              code: "Enter",
              keyCode: 13,
              which: 13,
              bubbles: true,
              cancelable: true
            });
            input.dispatchEvent(enterEvent);
          }, 100);

          removeDropdown();
        });

        dropdown!.appendChild(item);
        currentItems.push(item); // Store item for keyboard navigation
      });

      document.body.appendChild(dropdown);
    };

    // Input event listener
    inputElement.addEventListener("input", (e) => {
      const query = (e.target as HTMLInputElement).value;

      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = window.setTimeout(() => {
        searchRecords(query);
      }, 300);
    });

    // Focus event listener
    inputElement.addEventListener("focus", () => {
      if (inputElement.value) {
        searchRecords(inputElement.value);
      }
    });

    // Keyboard navigation
    inputElement.addEventListener("keydown", (e) => {
      if (!dropdown || currentItems.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          selectedIndex = Math.min(selectedIndex + 1, currentItems.length - 1);
          highlightItem(selectedIndex);
          break;

        case "ArrowUp":
          e.preventDefault();
          selectedIndex = Math.max(selectedIndex - 1, -1);
          highlightItem(selectedIndex);
          break;

        case "Enter":
          e.preventDefault();
          if (selectedIndex >= 0) {
            selectItem(selectedIndex);
          }
          break;

        case "Escape":
          e.preventDefault();
          removeDropdown();
          break;
      }
    });

    // Click outside to close
    document.addEventListener("click", (e) => {
      if (dropdown && !dropdown.contains(e.target as Node) && e.target !== inputElement) {
        removeDropdown();
      }
    });
  };

  // Helper function to attach autocomplete to lookup fields
  const attachAutocompleteToFields = () => {
    console.log('=== attachAutocompleteToFields called ===');
    console.log('Selected field objects:', selectedFieldObjects);

    // Also log all lookup field containers to see what classes they have
    const allLookupContainers = document.querySelectorAll('.control-lookup-field-gaia');
    console.log(`\nFound ${allLookupContainers.length} total lookup containers on page:`);
    allLookupContainers.forEach((container, index) => {
      console.log(`  Container ${index + 1}:`, container.className);
    });

    selectedFieldObjects.forEach((fieldConfig: any) => {
      const fieldCode = fieldConfig.fieldCode;
      console.log(`\n--- Processing field: ${fieldConfig.label} (${fieldCode}) ---`);

      // Method 1: Find by label text (for main form fields)
      const allLabelElements = document.querySelectorAll('.control-label-text-gaia');
      console.log(`Found ${allLabelElements.length} label elements`);

      let foundByLabel = false;
      for (const labelElement of Array.from(allLabelElements)) {
        const labelText = labelElement.textContent?.trim();

        if (labelText === fieldConfig.label) {
          console.log(`✓ Found label match: "${labelText}"`);
          foundByLabel = true;
          const controlGaia = labelElement.closest('.control-gaia');

          if (controlGaia) {
            let inputElement = controlGaia.querySelector('input.input-text-cybozu') as HTMLInputElement;

            if (!inputElement) {
              inputElement = controlGaia.querySelector('input[type="text"]') as HTMLInputElement;
            }

            if (inputElement && !inputElement.dataset.autocompleteAttached) {
              console.log('✓ Attached autocomplete to main form field');
              createAutocomplete(inputElement, fieldConfig);
              inputElement.dataset.autocompleteAttached = 'true';
            } else if (inputElement?.dataset.autocompleteAttached) {
              console.log('⚠️ Autocomplete already attached to this element');
            }
          }
        }
      }

      if (!foundByLabel) {
        console.log('❌ No label match found');
      }

      // Method 2: Find table fields by searching within table structure
      // Table fields are identified by matching the field label in table header
      if (fieldConfig.tableName) {
        console.log(`\nLooking for table field "${fieldConfig.label}" in table "${fieldConfig.tableName}"`);

        // Find all table headers with matching label text
        const allTableHeaders = document.querySelectorAll('.subtable-label-gaia .subtable-label-inner-gaia');
        console.log(`Found ${allTableHeaders.length} table headers`);

        let columnClass: string | null = null;
        for (const header of Array.from(allTableHeaders)) {
          const headerText = header.textContent?.trim().replace('*', ''); // Remove required asterisk
          console.log(`  Checking header: "${headerText}"`);

          if (headerText === fieldConfig.label) {
            // Found matching header, get the column class from parent th
            const th = header.closest('th');
            if (th) {
              // Extract class like "label-6678604"
              const classList = Array.from(th.classList);
              const labelClass = classList.find(cls => cls.startsWith('label-'));
              if (labelClass) {
                columnClass = labelClass.replace('label-', 'field-');
                console.log(`✓ Found matching header, column class: ${columnClass}`);
                break;
              }
            }
          }
        }

        if (columnClass) {
          // Find all input elements in this column
          const fieldElements = document.querySelectorAll(`.${columnClass}.control-lookup-field-gaia input.input-text-cybozu`);
          console.log(`Found ${fieldElements.length} input elements for column ${columnClass}`);

          let attachedCount = 0;
          for (const inputElement of Array.from(fieldElements) as HTMLInputElement[]) {
            if (!inputElement.dataset.autocompleteAttached) {
              console.log(`✓ Attached autocomplete to table field`);
              createAutocomplete(inputElement, fieldConfig);
              inputElement.dataset.autocompleteAttached = 'true';
              attachedCount++;
            } else {
              console.log('⚠️ Autocomplete already attached to table field');
            }
          }

          if (attachedCount > 0) {
            console.log(`✓ Successfully attached autocomplete to ${attachedCount} table field(s)`);
          }
        } else {
          console.log('❌ Could not find table column for this field');
        }
      }
    });

    console.log('=== attachAutocompleteToFields finished ===\n');
  };

  // Handle record create and edit events
  const events = ["app.record.create.show", "app.record.edit.show"];

  kintone.events.on(events, (event) => {
    if (selectedFieldObjects.length === 0) {
      return event;
    }

    // Use setTimeout to ensure DOM is ready
    setTimeout(() => {
      attachAutocompleteToFields();
    }, 100);

    return event;
  });

  // Handle table row add event (for lookup fields in tables)
  kintone.events.on(['app.record.create.change.*', 'app.record.edit.change.*'], (event) => {
    if (selectedFieldObjects.length === 0) {
      return event;
    }

    // Use setTimeout to ensure new row DOM is ready
    setTimeout(() => {
      attachAutocompleteToFields();
    }, 100);

    return event;
  });
})(kintone.$PLUGIN_ID);
