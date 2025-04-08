import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { LoggerProxy } from 'n8n-workflow';
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
				default: '*** Settings ***\n\n*** Variables ***\n\n*** Tasks ***\n\n*** Keywords ***',
				description:
					'Enter the full Robot Framework script here, including Settings, Variables, Tasks/Test Cases, and Keywords sections',
			},
			{
				displayName: 'Include Output JSON',
				name: 'includeOutputJson',
				type: 'boolean',
				default: false,
				description: 'Whether to include the output.JSON file as an attachment',
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
			const variables: Record<string, string> = {};

			const tests = outputJson?.suite?.tests || [];
			const entries: any[] = tests.flatMap((test: any) => test.body || []);

			entries.forEach((entry: any) => {
				if (
					(entry.name === 'Log' || entry.name === 'Log To Console') &&
					entry.owner === 'BuiltIn' &&
					Array.isArray(entry.body) &&
					Array.isArray(entry.args)
				) {
					const variableNameMatch = entry.args[0]?.match(/^\$\{(.*?)\}$/);
					if (variableNameMatch) {
						const variableName = variableNameMatch[1].trim();

						const messageEntry = entry.body.find(
							(item: any) => item.type === 'MESSAGE' && item.level === 'INFO',
						);

						if (messageEntry && messageEntry.message) {
							variables[variableName] = messageEntry.message.trim();
						}
					}
				}
			});

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

		const prepareExecutionPaths = (itemIndex: number): { logPath: string; robotFilePath: string } => {
			const homeDir = os.homedir();
			const executionId = this.getExecutionId();
			const nodeName = this.getNode().name.replace(/\s+/g, '_');
			const logPath = path.join(homeDir, 'n8n_robot_logs', executionId, nodeName, `run_${itemIndex + 1}`);
			if (!fs.existsSync(logPath)) {
				fs.mkdirSync(logPath, { recursive: true });
			}
			const robotFilePath = path.join(logPath, 'script.robot');
			return { logPath, robotFilePath };
		};

		const runRobotTests = async (logPath: string, robotFilePath: string) => {
			let terminalOutput = '';
			let errorOccurred = false;
			try {
				const { stdout } = await execAsync(`robot -d ${logPath} --output output.json ${robotFilePath}`);
				terminalOutput = stdout;
			} catch (error) {
				terminalOutput = (error as any).stdout || (error as any).stderr || 'Execution error with no output';
				errorOccurred = true;
			}
			terminalOutput = stripOutputPart(terminalOutput);
			return { terminalOutput, errorOccurred };
		};

		const extractVariablesFromOutput = (outputJsonPath: string) => {
			const outputJson = JSON.parse(fs.readFileSync(outputJsonPath, 'utf8'));
			return extractVariables(outputJson);
		};

		const collectAttachments = (logPath: string, options: { outputJson: boolean; logHtml: boolean; reportHtml: boolean }) => {
			const outputFiles = [
				{ name: 'output.json', path: path.join(logPath, 'output.json'), include: options.outputJson },
				{ name: 'log.html', path: path.join(logPath, 'log.html'), include: options.logHtml },
				{ name: 'report.html', path: path.join(logPath, 'report.html'), include: options.reportHtml },
			];
			const attachments: { [key: string]: any } = {};
			addAttachments(outputFiles, attachments);
			return attachments;
		};

        LoggerProxy.debug('Entry Point');
		const items = this.getInputData();
		const results: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			const robotScript = `*** Settings ***\n\n${this.getNodeParameter('robotScript', itemIndex, '') as string}`;
			const includeOutputJson = this.getNodeParameter('includeOutputJson', itemIndex, false) as boolean;
			const includeLogHtml = this.getNodeParameter('includeLogHtml', itemIndex, false) as boolean;
			const includeReportHtml = this.getNodeParameter('includeReportHtml', itemIndex, false) as boolean;
			const includeOtherFields = this.getNodeParameter('includeOtherFields', itemIndex, false) as boolean;

			const { logPath, robotFilePath } = prepareExecutionPaths(itemIndex);
			fs.writeFileSync(robotFilePath, robotScript);

			const { terminalOutput, errorOccurred } = await runRobotTests(logPath, robotFilePath);
			const outputJsonPath = path.join(logPath, 'output.json');
			if (!fs.existsSync(outputJsonPath)) {
				throw new NodeOperationError(this.getNode(), terminalOutput);
			}
			const variables = extractVariablesFromOutput(outputJsonPath);
			const transformedVariables = transformVariables(variables);

			const attachments = collectAttachments(logPath, {
				outputJson: includeOutputJson,
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
				throw new NodeOperationError(this.getNode(), terminalOutput);
			}

			results.push(outputItem);
		}
		return [results];
	}
}