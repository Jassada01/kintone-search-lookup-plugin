import { Button, Spinner, Notification, MultiChoice } from "kintone-ui-component";
import { classNames, ids } from "../common/config/constants";
import i18n from "../common/i18n/i18n";

((PLUGIN_ID: string) => {
  "use strict";
  const CONFIG = kintone.plugin.app.getConfig(PLUGIN_ID);
  console.log(CONFIG);

  const cancelButton = new Button({
    text: i18n.t("config.label.cancel"),
    type: "normal",
    className: classNames.cancelButton
  });

  cancelButton.addEventListener("click", () => {
    history.back();
  });

  const saveButton = new Button({
    text: i18n.t("config.label.save"),
    type: "submit",
    className: classNames.saveButton
  });

  saveButton.addEventListener("click", async () => {
    const multiChoice = (window as any).lookupFieldsMultiChoice as MultiChoice;
    const lookupFieldsData = (window as any).lookupFieldsData || [];
    const selectedFieldCodes = multiChoice ? multiChoice.value : [];

    // Filter to get only selected field objects
    const selectedFieldObjects = lookupFieldsData.filter((field: any) =>
      selectedFieldCodes.includes(field.fieldCode)
    );

    const newConfig = {
      selectedFields: JSON.stringify(selectedFieldCodes),
      selectedFieldObjects: JSON.stringify(selectedFieldObjects)
    };

    console.log("Saving config:", newConfig);
    console.log("Selected Field Objects:", selectedFieldObjects);
    kintone.plugin.app.setConfig(newConfig);
  });

  const settingFooter = document.getElementById(
    ids.configFooter
  ) as HTMLDivElement;
  settingFooter.appendChild(cancelButton);
  settingFooter.appendChild(saveButton);

  // Main
  const notification = new Notification({
    type: "danger"
  });
  const spinner = new Spinner();
  spinner.open();

  const loadAppFields = async () => {
    try {
      // Get current app ID
      const appId = kintone.app.getId();
      console.log("App ID:", appId);

      // Get form fields
      const fields = await (kintone.app as any).getFormFields();
      console.log("App Fields:", fields);

      // Debug: Log SUBTABLE fields specifically
      Object.entries(fields).forEach(([fieldCode, field]: [string, any]) => {
        if (field.type === "SUBTABLE") {
          console.log(`\nSUBTABLE found: ${field.label} (${fieldCode})`);
          console.log("  Fields in table:", field.fields);
          console.log("  Full field object:", JSON.stringify(field, null, 2));
        }
      });

      // Collect all lookup fields (including those in tables)
      const lookupFields: Array<{ fieldCode: string; label: string; type: string; location: string; lookup: any; tableName?: string }> = [];

      Object.entries(fields).forEach(([fieldCode, field]: [string, any]) => {
        // Check if it's a SINGLE_LINE_TEXT with lookup (only main form fields)
        if (field.type === "SINGLE_LINE_TEXT" && field.lookup) {
          lookupFields.push({
            fieldCode: field.code || fieldCode, // Use numeric code if available
            label: field.label || "",
            type: field.type,
            location: "Main Form",
            lookup: field.lookup
          });
        }

        // Skip table fields - we don't need to collect them for settings
      });

      console.log("Lookup Fields:", lookupFields);

      // Debug: Show field codes clearly
      console.log("\nField codes mapping:");
      lookupFields.forEach(field => {
        console.log(`  ${field.label}: fieldCode="${field.fieldCode}", location="${field.location}"`);
      });

      // Display fields in the config page
      const rootElement = document.getElementById(ids.configRoot) as HTMLDivElement;

      // Create title
      const title = document.createElement("h2");
      title.textContent = `Select Lookup Fields (${lookupFields.length})`;
      title.style.marginBottom = "16px";
      rootElement.appendChild(title);

      if (lookupFields.length === 0) {
        const message = document.createElement("p");
        message.textContent = "No SINGLE_LINE_TEXT fields with lookup configuration found.";
        rootElement.appendChild(message);
      } else {
        // Create MultiChoice items
        const items = lookupFields.map((field) => ({
          label: `${field.label} (${field.fieldCode})`,
          value: field.fieldCode
        }));

        // Get saved configuration
        const savedFieldCodes = CONFIG.selectedFields ? JSON.parse(CONFIG.selectedFields) : [];

        // Create MultiChoice component
        const multiChoice = new MultiChoice({
          items: items,
          value: savedFieldCodes
        });

        // Add label
        const label = document.createElement("label");
        label.textContent = "Select fields to enable autocomplete search:";
        label.style.display = "block";
        label.style.marginBottom = "8px";
        label.style.fontWeight = "bold";
        rootElement.appendChild(label);

        // Add MultiChoice to page
        rootElement.appendChild(multiChoice);

        // Store both MultiChoice and lookupFields data for saving
        (window as any).lookupFieldsMultiChoice = multiChoice;
        (window as any).lookupFieldsData = lookupFields;
      }

      spinner.close();
    } catch (error) {
      notification.text = (error as Error).message;
      notification.open();
      console.error(error);
      spinner.close();
    }
  };

  loadAppFields();
})(kintone.$PLUGIN_ID);
