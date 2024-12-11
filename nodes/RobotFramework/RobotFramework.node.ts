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
import * as os from 'os';

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
			{
				displayName: 'Include Other Input Fields',
				name: 'includeOtherFields',
				type: 'boolean',
				default: false,
				description:
					"Whether to pass to the output all the input fields (along with variables from 'Robot Framework' node)",
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const stripOutputPart = (terminalOutput: string): string => {
			const lastOutputIndex = terminalOutput.lastIndexOf('Output:');
			if (lastOutputIndex !== -1) {
				return terminalOutput.substring(0, lastOutputIndex).trim();
			}
			return terminalOutput;
		};

		const addAttachments = (files: { name: string; path: string; include: boolean }[], attachments: { [key: string]: any }) => {
			files.forEach((file) => {
				if (file.include && fs.existsSync(file.path)) {
					attachments[file.name] = {
						data: fs.readFileSync(file.path).toString('base64'),
						mimeType: 'application/octet-stream',
						fileName: file.name,
					};
				}
			});
		};

		const extractVariables = (outputJson: any): Record<string, string> => {
			const exclusionList = [
				"${/}", "${:}", "${\\n}", "${DEBUG_FILE}", "${EXECDIR}", "${False}",
				"${LOG_FILE}", "${LOG_LEVEL}", "${None}", "${null}", "&{OPTIONS}",
				"${OUTPUT_DIR}", "${OUTPUT_FILE}", "${PREV_TEST_MESSAGE}", "${PREV_TEST_NAME}",
				"${PREV_TEST_STATUS}", "${REPORT_FILE}", "${SPACE}",
				"${SUITE_DOCUMENTATION}", "&{SUITE_METADATA}", "${SUITE_NAME}", "${SUITE_SOURCE}",
				"${TEMPDIR}", "${True}"
			];

			const variables: Record<string, string> = {};

			function escapeRegExp(string: string): string {
				return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			}

			// Recursive function to process nested bodies
			function processBody(body: any[]) {
				for (const step of body) {
					if (step.assign && step.body) {
						for (const assignedVar of step.assign) {
							const message = step.body.find(
								(entry: any) =>
									entry.type === "MESSAGE" &&
									new RegExp(`^${escapeRegExp(assignedVar)}\\s*=`).test(entry.message)
							);
							if (message) {
								const value = message.message.split(" = ")[1].trim();
								variables[assignedVar] = value;
							}
						}
					}

					// Recursively process nested bodies
					if (step.body) {
						processBody(step.body);
					}
				}
			}

			// Process the tests
			if (outputJson.tests) {
				for (const test of outputJson.tests) {
					if (test.body) {
						processBody(test.body);
					}
				}
			}

			// Process the setup section
			if (outputJson.setup && outputJson.setup.name === "Log Variables") {
				const logMessages = outputJson.setup.body.filter((entry: any) => entry.type === "MESSAGE");
				for (const message of logMessages) {
					const match = message.message.match(/^\$\{.*?\}\s*=\s*(.*)$/);
					if (match) {
						const variableName = message.message.split(" = ")[0].trim();
						const variableValue = match[1];
						if (!exclusionList.includes(variableName)) {
							variables[variableName] = variableValue;
						}
					}
				}
			}

			return variables;
		};

		const transformVariables = (variables: { [key: string]: any }) => {
			const transformed: { [key: string]: string } = {};
			for (const key in variables) {
				const cleanKey = key.replace(/^\$\{|\}$/g, '');
				transformed[cleanKey] = variables[key];
			}
			return transformed;
		};

		const prepareExecutionPaths = (): { logPath: string; robotFilePath: string } => {
			const homeDir = os.homedir();
			const executionId = this.getExecutionId();
			const nodeName = this.getNode().name.replace(/\s+/g, '_');
			const logPath = path.join(homeDir, 'n8n_robot_logs', executionId, nodeName);
			if (!fs.existsSync(logPath)) {
				fs.mkdirSync(logPath, { recursive: true });
			}
			const robotFilePath = path.join(logPath, 'test.robot');
			return { logPath, robotFilePath };
		};

		const runRobotTests = async (logPath: string, robotFilePath: string) => {
			let terminalOutput = '';
			let errorOccurred = false;
			try {
				const { stdout } = await execAsync(`robot -d ${logPath} --output output.xml ${robotFilePath}`);
				terminalOutput = stdout;
			} catch (error) {
				terminalOutput = (error as any).stdout || (error as any).stderr || 'Execution error with no output';
				errorOccurred = true;
			}
			terminalOutput = stripOutputPart(terminalOutput);
			return { terminalOutput, errorOccurred };
		};

		const generateOutputJson = async (logPath: string, outputJsonPath: string) => {
			const outputXmlPath = path.join(logPath, 'output.xml');
			try {
				await execAsync(`rebot --log NONE --report NONE --output ${outputJsonPath} ${outputXmlPath}`);
			} catch (error: any) {
				if (!fs.existsSync(outputJsonPath)) {
					throw new NodeOperationError(this.getNode(), 'Rebot failed and output.json is missing.');
				}
			}
		};

		const extractVariablesFromOutput = (outputJsonPath: string) => {
			const outputJson = JSON.parse(fs.readFileSync(outputJsonPath, 'utf8'));
			return extractVariables(outputJson);
		};

		const collectAttachments = (logPath: string, options: { outputXml: boolean; logHtml: boolean; reportHtml: boolean }) => {
			const outputFiles = [
				{ name: 'output.xml', path: path.join(logPath, 'output.xml'), include: options.outputXml },
				{ name: 'log.html', path: path.join(logPath, 'log.html'), include: options.logHtml },
				{ name: 'report.html', path: path.join(logPath, 'report.html'), include: options.reportHtml },
			];
			const attachments: { [key: string]: any } = {};
			addAttachments(outputFiles, attachments);
			return attachments;
		};

		const items = this.getInputData();
		const results: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			const robotScript = `*** Settings ***\nSuite Setup    Log Variables\n${this.getNodeParameter('robotScript', itemIndex, '') as string}`;
			const includeOutputXml = this.getNodeParameter('includeOutputXml', itemIndex, false) as boolean;
			const includeLogHtml = this.getNodeParameter('includeLogHtml', itemIndex, false) as boolean;
			const includeReportHtml = this.getNodeParameter('includeReportHtml', itemIndex, false) as boolean;
			const includeOtherFields = this.getNodeParameter('includeOtherFields', itemIndex, false) as boolean;

			const { logPath, robotFilePath } = prepareExecutionPaths();
			fs.writeFileSync(robotFilePath, robotScript);

			const { terminalOutput, errorOccurred } = await runRobotTests(logPath, robotFilePath);
			const outputJsonPath = path.join(logPath, 'output.json');
			await generateOutputJson(logPath, outputJsonPath);
			const variables = extractVariablesFromOutput(outputJsonPath);
			const transformedVariables = transformVariables(variables);

			const attachments = collectAttachments(logPath, {
				outputXml: includeOutputXml,
				logHtml: includeLogHtml,
				reportHtml: includeReportHtml,
			});

			let outputItem: INodeExecutionData = {
				json: errorOccurred
					? { error: { terminal_output: terminalOutput, ...transformedVariables } }
					: { terminal_output: terminalOutput, ...transformedVariables },
				binary: attachments,
			};

			if (includeOtherFields) {
				outputItem.json = {
					...items[itemIndex].json,
					...outputItem.json,
				};
			}

			if (errorOccurred && !this.continueOnFail()) {
				throw new NodeOperationError(this.getNode(), outputItem.json);
			}

			results.push(outputItem);
		}

		return [results];
	}
}