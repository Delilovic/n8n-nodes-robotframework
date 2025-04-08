
# n8n-nodes-robotframework

This is an n8n community node that enables you to execute [Robot Framework](https://robotframework.org/) scripts directly within your n8n workflows, combining the power of low-code automation with advanced test and robotic process automation (RPA).

[n8n](https://n8n.io/) is a low-code workflow automation tool similar to Zapier and Make, designed to automate complex workflows with ease. [Robot Framework](https://robotframework.org/) is a versatile automation framework widely used for robotic process automation (RPA), acceptance testing, and more. This node bridges the two systems, allowing seamless execution of Robot Framework scripts inside n8n workflows.

One of the most exciting use cases of this integration is with the [Robot Framework Browser library](https://robotframework-browser.org/), which supports UI-based interactions like user clicks and website automation without requiring a GUI system environment — everything runs smoothly inside a Docker container housing both n8n and the Robot Framework node.


## Installation

This guide walks you through setting up the Robot Framework Node in **n8n** and running **n8n** locally using a Docker container. You can follow either the **Quick Start** or **Detailed Instructions**, based on your preference.

### Quick Navigation
- [Quick Start](#quick-start)
- [Detailed Instructions](#detailed-instructions)
- [Installing Community Node](#installing-community-node)

---

### Quick Start

To quickly set up, ensure **Docker** is installed, then run the following command:

```bash
docker run -it --rm --name n8n -p 5678:5678 -v n8n_data:/home/node/.n8n delilovic/n8n_robotframework:latest
```

Once the container is up and running, you will see the following message in the terminal:

```bash
Editor is now accessible via:
http://localhost:5678/
```

Open this URL in your browser to start using **n8n**. Next, follow the [Installing Community Node](#installing-community-node) section to add the Robot Framework Node.

---

### Detailed Instructions

#### Using the Default n8n Docker Image (Not Recommended)

The default Docker image for **n8n** is based on **Alpine Linux**. To set it up, you can refer to the official installation guide: [Official n8n Docker Installation Guide](https://docs.n8n.io/hosting/installation/docker/).

By default, the Alpine-based Docker image does not include Python and Robot Framework pre-installed. Users need to manually install these dependencies. It has been verified that after installing these dependencies, the Robot Framework node becomes fully functional and ready for use.

Please ensure Python and Robot Framework are installed inside the Docker container before proceeding.

#### Using the Custom `n8n_robotframework` Docker Image (Recommended)

If you are using the **Robot Framework Browser Library**, you’ll need the custom Docker image **n8n_robotframework**, which is based on **Debian Bullseye**. This custom image includes pre-installed dependencies, such as Python, Robot Framework, and the Browser Library.
This setup ensures that the Robot Framework community node works out of the box.

1. Replace the default image in your setup:
   ```bash
   docker.n8n.io/n8nio/n8n
   ```
   with:
   ```bash
   delilovic/n8n_robotframework:latest
   ```

2. To run the custom Docker container, execute:
   ```bash
   docker run -it --rm --name n8n2 -p 5678:5678 -v n8n_data:/home/node/.n8n delilovic/n8n_robotframework:latest
   ```

Once the container is up and running, you will see the following message in the terminal:

```bash
Editor is now accessible via:
http://localhost:5678/
```

Open this URL in your browser to start using **n8n**. Then proceed to the next step, [Installing Community Node](#installing-community-node), to add the Robot Framework Node.

---

### Installing Community Node

After setting up **n8n** (via either Quick Start or Detailed Instructions), follow these steps:

1. **Access Settings**:
   - Navigate to **n8n settings** in your instance.

2. **Open Community Node Section**:
   - Go to **Community Nodes**.

3. **Install Robot Framework Node**:
   - Click the **Install** button and enter:

     ```plaintext
     n8n-nodes-robotframework
     ```

   - Confirm the installation.

4. **Refresh the Page**:
   - Refresh your browser window to apply the changes.

5. **Start Using the Node**:
   - The **Robot Framework Node** will now be available in your **n8n** workflow editor.

---

### About the Custom n8n_robotframework Image

The custom Docker image, **n8n_robotframework**, is regularly updated alongside major versions of **n8n** (e.g., 1.72.0, 1.73.0, etc.). It is specifically designed to support the Robot Framework and its Browser Library while requiring minimal changes to the original image.

Additionally, the Robot Framework and the Browser Library are automatically updated to their latest versions every time the build runs for new **n8n** major versions.

You can access its source code or contribute at this GitHub repository:  
[GitHub Repository - Custom n8n Robot Framework Image](https://github.com/Delilovic/n8n-debian/tree/master/docker/images)

## Usage Example

In this example, we will demonstrate the capabilities of **n8n** and **Robot Framework** with a simple yet powerful use case: performing a user login on a website and validating that the user is logged in successfully.

The example highlights the ability to interact with websites, capture screenshots, and maintain browser context while executing workflows across multiple nodes. Each node represents a separate execution.

Additionally, we will showcase how to export the Robot Framework's report files and pass variables between nodes seamlessly.

### Overview
![1_overview.png](screenshots/1_overview.png)

The workflow shown in the image consists of five nodes: a trigger node, two Robot Framework nodes, a file reader node, and a Telegram node. The trigger node starts the workflow when the **Test workflow** button is clicked. The first Robot Framework node handles the login process, while the second validates that the login was successful and captures a screenshot. The file reader node then reads the screenshot from the disk and passes it as a binary file to the Telegram node. Finally, the Telegram node sends the screenshot with the caption "Login was successful."

### Login Node Details
![2_login_node.png](screenshots/2_login_node.png)

When we open the Login node, we see the Robot Framework script area, where the code for automating the login process is written. In this example, we have selected the **Include Log HTML** option to ensure an execution report (log.html) is generated after the script runs.

As the node has already been executed, the log.html file is now available for download on the Output panel, providing a detailed log of the execution.

There is also an option to toggle **Include Other Input Fields**, which would pass variables from the previous node to the script. However, since the previous node is a trigger node without any relevant data to pass, this option has been left disabled.

![3_login_node_code.png](screenshots/3_login_node_code.png)

The Login Node contains classic Robot Framework code with its standard structure, which includes Settings, Variables, and Tasks (with support for Keywords and Tests as well). In this example, the Browser Library is used to perform the following actions:
* **Failure Handling:** The task begins by registering `Take Screenshot` (with the `EMBED` argument) as the failure handler using `Register Keyword To Run On Failure`. This ensures that a screenshot is automatically captured and embedded into the log in case any step during the execution fails. This is particularly useful for debugging issues in automated workflows.
* Open a new browser instance in headless mode with a registered `userAgent`.
* Navigate to the login page using the `${URL}` defined in the variables section.
* Wait for the cookie consent modal (`div.fc-consent-root`) to be hidden before proceeding.
* Enter the username (`${USERNAME}`) and password (`${PASSWORD}`) into their respective input fields.
* Capture a full-page screenshot during the login process, embedded directly into the log for easier debugging or verification.
* Click on the login button to authenticate.
* Save the current URL (`${current_url}`) and browser state (`${state_file}`) to maintain session continuity across nodes.
* Close the browser instance once the actions are complete.
* Log both the current URL and the saved browser state for reuse in subsequent nodes.

### Key Notes:
- **Failure Handling**: The `Register Keyword To Run On Failure` ensures screenshots (`Take Screenshot`) are automatically captured and embedded into the logs if any failure occurs during execution. This is done by passing the `EMBED` argument, making the logs more informative and accessible directly from the report.
- **Session Continuity:** The use of `${state_file}` ensures session continuity. This allows the **Validate Login** node to resume exactly where the **Login** node left off, avoiding the need for reauthentication.
- **User-Agent Configuration:** A custom `userAgent` is passed via `New Context`, simulating a specific browser environment (`Mozilla/5.0...Chrome/124.0...Safari/537.36`), which is helpful for compatibility testing.

Variables in the Robot Framework node are no longer automatically forwarded between nodes. Instead, variables must explicitly be passed to subsequent nodes using the `Log` keyword (e.g., `Log ${foo}`). This approach ensures that only the intended variables are available to downstream nodes, improving efficiency and clarity within workflows.

Additionally, the Robot Framework's standard output is automatically included, providing the framework's typical execution status and result details.

![4_login_node_report.png](screenshots/4_login_node_report.png)

The log.html report file displays the standard Robot Framework execution report. It includes details such as the execution status (PASS), the steps performed (e.g., opening a new browser, navigating to the URL, and entering credentials), and the time taken for each step.

Additionally, as defined in the code, the report includes the screenshot taken just before pressing the login button. This provides a visual confirmation of the login page and the filled-in credentials at the time of execution, making it easier to verify and debug the automation process.

### Validate Node Details

![5_validate_node.png](screenshots/5_validate_node.png)

In the **Validate Login** node, the input panel on the left displays the variables and values passed from the preceding **Login** node, which uses the `Log` keyword to pass the browser context `state_file` and the URL `current_url` to the **Validate Login** node. These variables are essential for this step as they enable the node to continue the session established during the login process without requiring reauthentication.

The Robot Framework script for validation is defined in the edit field, utilizing the passed browser context and URL to verify the success of the login operation. We have enabled **Log HTML** generation to provide a comprehensive execution report for this step.

For demonstration purposes, the **Include Other Input Fields** toggle is enabled to pass all output variables from the **Validate Login** node to the next **Read Screenshot from Disk** node. In cases where duplicate variables with the same name exist, such as `terminal_output`, the variable generated in the **current Validate Login** node takes precedence over the one received from the **Login** node. However, these additional variables will not be used in the subsequent **Read Screenshot from Disk** node.

![6_validate_node_code.png](screenshots/6_validate_node_code.png)

In the **Validate Login** node, we use the **Expression View**, which allows us to dynamically reference JavaScript expressions and variables from the previous node. Instead of hardcoding values, we utilize variables such as `{{ $json.current_url }}` and `{{ $json.state_file }}`. On the right side, we can see how these expressions are evaluated after the node is executed, as the variables and their values are now known to the editor.

This implementation reuses the browser context `state_file` from the previous node, enabling the browser to resume exactly where it left off. The workflow navigates to the saved URL and verifies the presence of a specific label ("Secure Area page for Automation Testing Practice") that appears only after a successful login. Additionally, the workflow captures a screenshot, which is sent via Telegram. The screenshot's file path is passed to the next node using the `Log` keyword.

By combining the use of variables from the previous node with runtime evaluations, this approach enhances the workflow's flexibility and adaptability to various inputs and scenarios.

![7_validate_node_report.png](screenshots/7_validate_node_report.png)

The log.html report generated from the **Validate Login** node confirms the successful execution of the validation step. Instead of embedding the captured screenshot, its file path is provided, allowing us to use it for further processing.

### Read Screenshot from Disk

This node converts the screenshot stored on the disk to a n8n binary file, which can then be used in the Telegram node to send it as an image.

### Telegram Node Integration

![8_telegram_node.png](screenshots/8_telegram_node.png)

Finally, the **Telegram** node demonstrates how seamlessly Robot Framework can integrate with other n8n nodes, such as AWS, OpenAI, Airtable, and many more.

In this example, the screenshot binary, which was read from disk in the previous node, is dynamically used in the **Telegram** node. The binary data is sent as a photo attachment, along with a caption reading: “Login was successful!”.

This setup highlights how easily you can combine Robot Framework automation with powerful integrations in n8n to create end-to-end workflows. By leveraging the ability to process files, interact with external APIs, and send notifications, n8n provides a seamless way to share updates across channels. The output panel confirms the successful delivery of the photo and caption to the Telegram channel, completing the workflow.

### Importing This Example into Your n8n Instance  

You can import this example into your n8n instance by following these steps:  

1. Create an empty workflow in your n8n instance.  
2. Open the workflow editor and click on the three dots `...` at the top right.  
3. Select **Import from File** from the dropdown menu.  
4. Upload the [Robot_Framework_Example.json](examples/Robot_Framework_Example.json) file, which you can download from the repository.  

This will load the entire example workflow into your instance, allowing you to explore and customize it as needed.  

Note: If you prefer not to create a Telegram API token or account, you can simply remove the **Telegram** node. Everything else will function as expected.

## Version history

- **0.0.1** - Initial release with support for script execution and output file generation.
- **0.0.2** - Enhanced terminal output readability for Robot Framework test results, preserving original spacing for better clarity in n8n json view.
- **0.0.3** - Refactored error handling and variable output:
  - Replaced console output with variable-based results for better clarity.
  - Improved error handling to display stderr messages during failures.
  - Centralized variable logging for improved maintainability and debugging.
  - Optimized code structure for test execution and error management.
- **0.0.4** - Refactored code for modularity and readability:
  - Extracted helper functions: prepareExecutionPaths, runRobotTests, generateOutputJson, extractVariablesFromOutput, and collectAttachments.
  - Simplified handling of terminal output and error reporting.
  - Improved variable extraction logic.
- **0.0.5**
  - Fixed error handling.
  - Add default Robot Framework structure to node.
  - Refactoring.
- **0.0.6 - 0.0.11**
  - Updated the README file with the latest changes.
  - Applied those changes to the npm website.
- **0.0.12** - Ensured that when the Robot Framework node runs multiple times within the same execution, each run gets its own dedicated folder.
- **0.0.13** - Applied those changes to the npm website.
- **0.0.14** - Update Robot Framework output parsing for v7.0+ and remove XML-to-JSON conversion:
  - Updated output parsing to use `outputJson.suite.tests` instead of `outputJson.tests`,  
    fixing compatibility with Robot Framework 7.0+ where test cases are now nested inside `suite`.  
  - Removed the `rebot` XML-to-JSON conversion step, leveraging Robot Framework 7.2’s native JSON output support.  
  - Improved variable extraction logic to align with the new JSON structure.
- **0.0.15** - Fix JSON linting issues in RobotFramework node.
- **0.0.16** - Add support for dynamic variable handling and improve error reporting for failed test cases.
- **0.0.17** - Added the Log feature to pass variables to the next node, and removed the automatic passing of variables to align with a more explicit workflow design. The example in this readme file has been adapted to reflect this change.
- **0.0.18** - Added a new feature where, alongside the keyword `Log`, it is now possible to pass variables to the next node using the Robot Framework keyword `Log To Console`. This provides an additional, flexible mechanism for variable handling between nodes in workflows.
- **0.0.19** - Removed the use of `Log To Console` for passing variables to the next node as it does not provide the required structure or data to be used effectively in workflows. Passing variables via the `Log` keyword remains the recommended and supported approach.
