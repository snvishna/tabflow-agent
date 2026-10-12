# Privacy Policy for TabFlow Agent

**Effective Date:** October 12, 2026

This Privacy Policy describes how TabFlow Agent ("we", "our", or "the extension") handles your data. We are committed to protecting your privacy and being fully transparent about how data is processed by the extension.

## 1. Information We Collect and Process

TabFlow Agent operates primarily as a local application within your browser. 

### A. Web Browsing Data
To detect duplicate tabs and categorize them into semantic groups, the extension reads the **URLs and Titles** of your currently open tabs and newly navigated pages. 

### B. Tab Archive and Activity Log (stored on your device)
- **Archive:** when TabFlow closes a tab for you (closing duplicates or archiving unused tabs), it saves that tab's URL, title and icon address in your browser's local database so you can search and restore it. Archived entries are deleted automatically after 90 days.
- **Activity log:** TabFlow keeps a log of its own actions (for example "closed 3 duplicate tabs") for 7 days so you can see what it did. You can clear it from the Activity Log page.
- **Undo history:** the last few actions are kept in temporary browser memory so you can undo them, and are cleared when the browser closes.

None of this leaves your device.

### C. Authentication Information
To utilize advanced AI features, you may optionally provide API keys (e.g., Google Gemini, OpenAI, Anthropic, or TypeSafe). These API keys are **stored securely and exclusively in your browser's local storage**.

## 2. How Your Data is Used

- **Local Deduplication and Grouping:** Duplicate detection and grouping run entirely on your device. The on-device AI model (an open-source text-embedding model) is downloaded once from Hugging Face (huggingface.co) the first time it is needed and then cached by your browser. This download does not include any of your tab data.
- **AI Processing (Remote):** If you configure the Cognitive Engine or Reflex Engine to use a remote AI provider, the extension will securely transmit the required tab URLs and titles directly to the API endpoint you specified (e.g., Google, OpenAI). 
- **No Extraneous Usage:** We do not use your data for advertising, creditworthiness, lending, or any purpose other than providing the tab management features of the extension.

## 3. Data Sharing and Disclosure

We do **not** collect, store, or transmit your data to our own servers. 

Your tab data (URLs and titles) is only transmitted to **third-party AI providers that you explicitly configure** via your API keys. We are not responsible for the privacy practices of those third-party providers (e.g., Google, OpenAI, Anthropic). Please review their respective privacy policies to understand how they handle data sent via their APIs.

We **do not sell, rent, or share** your personal data or browsing history with any third parties for marketing or advertising purposes.

## 4. Data Security

All configurations, including your API keys and local AI embeddings, are stored locally within your browser's secure extension storage sandbox. The extension uses encrypted HTTPS connections when communicating with your configured remote AI providers.

## 5. Your Rights and Choices

Because we do not store your data on our servers, you have total control over your data:
- **Revoke Access:** You can clear your API keys from the extension's Advanced Settings at any time to immediately halt all remote data transmission.
- **Data Deletion:** Uninstalling the extension will automatically wipe all locally stored settings, API keys, the tab archive, the activity log and cached embeddings from your browser.

## 6. Changes to this Privacy Policy

We may update this Privacy Policy from time to time. Any changes will be reflected in the "Effective Date" at the top of this policy and included in the extension's release notes.

## 7. Contact Us

If you have any questions or concerns about this Privacy Policy or how TabFlow Agent handles your data, please contact us by opening an issue on our [GitHub Repository](https://github.com/snvishna/tabflow-agent).
