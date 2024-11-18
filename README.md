
# n8n-nodes-robotframework

This is an n8n community node that lets you execute [Robot Framework](https://robotframework.org/) scripts in your n8n workflows, enabling test automation, web automation, and task automation directly within n8n.

---

## Proof of Concept

This project is a **proof of concept** demonstrating the integration of Robot Framework into n8n workflows. It showcases how Robot Framework scripts can be executed within n8n, highlighting the flexibility and potential of merging these two great open-source projects.

### Key Features:

- **Run normal Robot Framework tests**
- **Run Browser UI Tests**
- **Capture images from websites** (can be passed to other nodes, such as ImageRecognition or OpenAI)
- **Capture test/task execution videos**

### Limitations:
- Each n8n node runs independently, meaning the output of one node must be passed explicitly to the next node.
- Special handling is required to manage data between nodes in complex workflows.

---

## Example Workflow: Browser Test Automation

This example demonstrates how to work around n8n's node isolation to use Robot Framework effectively with the **Browser Library**.

### Full Workflow Overview:
![alt text](<screenshots/Main Workflow.png>)

The workflow tests a simple scenario:
1. Log in to a website.
2. Validate that the login was successful.
3. Demonstrate how to handle browser context across multiple nodes.

---

### **Login Node**:
![alt text](<screenshots/Login Overview.png>)

- The Login Node allows defining Robot Framework code and selecting which output files (e.g., logs) to generate.  
- For this example, we generated the `log.html` file.

![alt text](<screenshots/Login Code.png>)

- This Robot Framework script uses the **Browser Library** (which must be installed on the n8n host alongside Robot Framework).
- The script:
  - Opens a headless browser.
  - Navigates to the login page.
  - Fills out and submits the login form.
  - Captures a screenshot and saves it to the report file.
  - Clicks the submit button.
  - Saves the last URL and browser context as variables.

![alt text](<screenshots/Login Output.png>)

- Outputs the last URL and browser context path for the next node.

![alt text](<screenshots/Login Report.png>)

- The generated report shows that the username and password were successfully filled. Note that submit happens after image capture.

---

### **Validate Node**:
![alt text](<screenshots/Validate Workflow.png>)

- The Validate Node takes the last URL and browser context from the Login Node as inputs.
- Since no new variables are set, this node's output remains empty.

![alt text](<screenshots/Validate Code.png>)

- The code:
  - Reloads the saved browser context.
  - Continues the session from the last URL.
  - Validates that the login was successful.

![alt text](<screenshots/Validate Report.png>)

- The Validate Node report confirms that the session resumed and the login was successfully validated.

---

## Feedback and Contributions

This project is in its early stages, and contributions or feedback are highly welcome!  
Feel free to submit issues, pull requests, or suggestions for improvement.

---

## Installation

To use this community node, follow these steps:

1. **Clone or Download the Repository**:
   ```bash
   git clone https://github.com/your-username/n8n-nodes-robotframework.git
   cd n8n-nodes-robotframework
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Build and Install the Node**:
   ```bash
   npm run build
   npm install -g .
   ```

4. **Restart n8n**:
   Restart your n8n instance to make the node available in the workflow editor.

---

## Compatibility

- This node is compatible with n8n versions that support custom nodes.
- Requires Robot Framework and any necessary libraries (e.g., Browser Library) to be installed and accessible on the same host.

---

## Resources

- [n8n Community Nodes Documentation](https://docs.n8n.io/integrations/community-nodes/)
- [Robot Framework Documentation](https://robotframework.org/)

---

## Version History

- **0.0.1**: Initial release with basic script execution and output file generation.
- **0.0.2**: Enhanced terminal output readability and improved JSON output formatting.
- **0.0.3**: Improved error handling, variable management, and centralized logging.
