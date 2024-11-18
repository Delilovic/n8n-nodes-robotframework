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
		group: ['Robot Framework'],
		version: 1,
		description:
			'Executes Robot Framework test scripts, allowing automation and testing directly within n8n workflows. Configure test scripts, control output file generation, and leverage Robot Framework capabilities for robust testing automation.',
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
				description:
					'Enter the full Robot Framework script here, including Settings, Variables, Test Cases, and Keywords sections',
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
			// Retrieve input parameters
			const robotScript = this.getNodeParameter('robotScript', itemIndex, '') as string;
			const includeOutputXml = this.getNodeParameter('includeOutputXml', itemIndex, false) as boolean;
			const includeLogHtml = this.getNodeParameter('includeLogHtml', itemIndex, false) as boolean;
			const includeReportHtml = this.getNodeParameter('includeReportHtml', itemIndex, false) as boolean;

			// Setup Paths and Directories
			const executionId = this.getExecutionId();
			const nodeName = this.getNode().name.replace(/\s+/g, '_');
			const logPath = path.join(process.cwd(), 'output', executionId, nodeName);
			ensureDirectoryExists(logPath);

			// Write Robot Framework script to a file
			const robotFilePath = path.join(logPath, 'test.robot');
			fs.writeFileSync(robotFilePath, robotScript);

			let terminalOutput = '';
			let errorOccurred = false;

			try {
				// Execute Robot Framework
				const { stdout, stderr } = await execAsync(`robot -d ${logPath} --output output.xml ${robotFilePath}`);
				terminalOutput = stdout || stderr;
				if (stderr) {
					errorOccurred = true;
				}
			} catch (error) {
				// Capture error details
				terminalOutput = (error as any).stdout || (error as any).stderr || 'Execution error with no output';
				errorOccurred = true;
			}

			// Cut out the "Output:" part of the terminalOutput
			terminalOutput = stripOutputPart(terminalOutput);

			// Initialize variables
			let variables: { [key: string]: any } = {};

			// Process success case: Extract variables
			if (!errorOccurred) {
				const outputJsonPath = path.join(logPath, 'output.json');
				try {
					await execAsync(`rebot --log NONE --report NONE --output ${outputJsonPath} ${path.join(logPath, 'output.xml')}`);
					if (fs.existsSync(outputJsonPath)) {
						const outputJson = JSON.parse(fs.readFileSync(outputJsonPath, 'utf8'));
						variables = extractVariablesFromOutputJson(outputJson);
					}
				} catch (error) {
					this.logger.error(`Failed to generate JSON output using rebot: ${(error as any).message}`);
				}
			}

			// Process optional file attachments
			const outputFiles = [
				{ name: 'output.xml', path: path.join(logPath, 'output.xml'), include: includeOutputXml },
				{ name: 'log.html', path: path.join(logPath, 'log.html'), include: includeLogHtml },
				{ name: 'report.html', path: path.join(logPath, 'report.html'), include: includeReportHtml },
			];
			const attachments: { [key: string]: any } = {};
			addAttachments(outputFiles, attachments);

			// Transform variables to remove ${} and directly return key-value pairs
			const transformedVariables: { [key: string]: string } = {};
			for (const key in variables) {
				const cleanKey = key.replace(/^\$\{|\}$/g, ''); // Remove ${ and }
				transformedVariables[cleanKey] = variables[key];
			}

			// Construct Result Item
			const outputItem: INodeExecutionData = {
				json: errorOccurred
					? { error: terminalOutput } // Keep error details if execution failed
					: Object.keys(transformedVariables).length > 0
					? transformedVariables // Directly return cleaned variables on success
					: {}, // Return empty object if no variables
				binary: errorOccurred ? undefined : attachments, // Attach files only if no error occurred
			};

			if (errorOccurred) {
				if (!this.continueOnFail()) {
					throw new NodeOperationError(this.getNode(), terminalOutput);
				}
			}

			results.push(outputItem);
		}

		return [results];
	}
}

// Helper Functions

function ensureDirectoryExists(directory: string) {
	if (!fs.existsSync(directory)) {
		fs.mkdirSync(directory, { recursive: true });
	}
}

function stripOutputPart(terminalOutput: string): string {
	const lastOutputIndex = terminalOutput.lastIndexOf('Output:');
	if (lastOutputIndex !== -1) {
		return terminalOutput.substring(0, lastOutputIndex).trim();
	}
	return terminalOutput;
}

function addAttachments(files: { name: string; path: string; include: boolean }[], attachments: { [key: string]: any }) {
	files.forEach((file) => {
		if (file.include && fs.existsSync(file.path)) {
			attachments[file.name] = {
				data: fs.readFileSync(file.path).toString('base64'),
				mimeType: 'application/octet-stream',
				fileName: file.name,
			};
		}
	});
}

function extractVariablesFromOutputJson(outputJson: any): { [key: string]: any } {
	const variables: { [key: string]: any } = {};

	const traverseBody = (body: any[]) => {
		body.forEach((item) => {
			if (item.name && item.assign && item.assign.length > 0) {
				item.assign.forEach((varName: string) => {
					item.body?.forEach((msg: any) => {
						if (msg.type === 'MESSAGE' && msg.message) {
							const match = msg.message.match(new RegExp(`^${escapeRegExp(varName)}\\s*=\\s*(.*)$`));
							if (match) {
								variables[varName] = match[1].trim();
							}
						}
					});
				});
			}
			if (item.body) {
				traverseBody(item.body);
			}
		});
	};

	outputJson.tests?.forEach((test: any) => {
		if (test.body) {
			traverseBody(test.body);
		}
	});

	return variables;
}

function escapeRegExp(string: string): string {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}