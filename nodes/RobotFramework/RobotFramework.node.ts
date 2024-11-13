import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

export class RobotFramework implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Robot Framework',
		name: 'robotFramework',
		icon: 'file:robotframework.svg',
		group: ['transform'],
		version: 1,
		description: 'Executes Robot Framework test scripts, allowing automation and testing directly within n8n workflows. Configure test scripts, control output file generation, and leverage Robot Framework capabilities for robust testing automation.',
		defaults: {
			name: 'Robot Framework',
		},
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			{
				displayName: 'Robot Framework Script',
				name: 'robotScript',
				type: 'string',
				default: '',
				placeholder: 
`*** Settings ***
Library    BuiltIn
Suite Setup    Log Suite Setup Started
Suite Teardown    Log Suite Teardown Completed

*** Variables ***
\${GREETING}    Hello, N8N Robot Framework!

*** Test Cases ***
Example Test Case
    [Setup]    Prepare Test
    Log    \${GREETING}
    [Teardown]    Cleanup Test

*** Keywords ***
Prepare Test
    Log    Preparing the test...

Cleanup Test
    Log    Cleaning up after the test...`,
				description: 'Enter the full Robot Framework script here, including Settings, Variables, Test Cases, and Keywords sections',
			},
			{
				displayName: '--- Output File Options ---',
				name: 'outputDivider',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Include Output XML',
				name: 'includeOutputXml',
				type: 'boolean',
				default: false,
				description: 'Whether to include the output.xml file as an attachment',
			},
			{
				displayName: 'Include Log HTML',
				name: 'includeLogHtml',
				type: 'boolean',
				default: false,
				description: 'Whether to include the log.html file as an attachment',
			},
			{
				displayName: 'Include Report HTML',
				name: 'includeReportHtml',
				type: 'boolean',
				default: false,
				description: 'Whether to include the report.html file as an attachment',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const results: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {

			// Retrieve the complete Robot Framework script and output file options from the node parameters
			const robotScript = this.getNodeParameter('robotScript', itemIndex, '') as string;
			const includeOutputXml = this.getNodeParameter('includeOutputXml', itemIndex, false) as boolean;
			const includeLogHtml = this.getNodeParameter('includeLogHtml', itemIndex, false) as boolean;
			const includeReportHtml = this.getNodeParameter('includeReportHtml', itemIndex, false) as boolean;

			// Retrieve the execution ID and node name for file path organization
			const executionId = this.getExecutionId();
			const nodeName = this.getNode().name.replace(/\s+/g, '_');
			const logPath = path.join(process.cwd(), 'output', executionId, nodeName);
			if (!fs.existsSync(logPath)) {
				fs.mkdirSync(logPath, { recursive: true });
			}

			// Define file path for the .robot file
			const robotFilePath = path.join(logPath, 'test.robot');

			// Write the complete Robot Framework script to the .robot file
			fs.writeFileSync(robotFilePath, robotScript);

			// Initialize terminal output and error flag
			let terminalOutput = '';
			let errorOccurred = false;

			// Run Robot Framework test and capture all terminal output
			try {
				const { stdout, stderr } = await execAsync(`robot -d ${logPath} --output output.xml ${robotFilePath}`);
				terminalOutput = stdout || stderr;
				if (stderr) {
					// If there's any error output in stderr, set errorOccurred to true
					errorOccurred = true;
				}
			} catch (error) {
				// Capture any output even on failure
				terminalOutput = (error as any).stdout || (error as any).stderr || 'Execution error with no output';
				errorOccurred = true;
			}

			// Remove everything after the last "Output:"
			const lastOutputIndex = terminalOutput.lastIndexOf('Output:');
			if (lastOutputIndex !== -1) {
				terminalOutput = terminalOutput.substring(0, lastOutputIndex).trim();
			}

			// Define paths for optional output files
			const outputFiles = [
				{ name: 'output.xml', path: path.join(logPath, 'output.xml'), include: includeOutputXml },
				{ name: 'log.html', path: path.join(logPath, 'log.html'), include: includeLogHtml },
				{ name: 'report.html', path: path.join(logPath, 'report.html'), include: includeReportHtml },
			];

			// Attach files if they exist and are requested
			const attachments: { [key: string]: any } = {};
			for (const file of outputFiles) {
				if (file.include && fs.existsSync(file.path)) {
					attachments[file.name] = {
						data: fs.readFileSync(file.path).toString('base64'),
						mimeType: 'application/octet-stream',
						fileName: file.name,
					};
				}
			}

			// Create output item with terminal output
			const outputItem: INodeExecutionData = {
				json: { terminalOutput },
				binary: attachments,
			};

			// If an error occurred, handle it based on continueOnFail setting
			if (errorOccurred) {
				if (this.continueOnFail()) {
					outputItem.error = new NodeOperationError(this.getNode(), terminalOutput);
				} else {
					throw new NodeOperationError(this.getNode(), terminalOutput);
				}
			}

			results.push(outputItem);
		}

		return [results];
	}
}