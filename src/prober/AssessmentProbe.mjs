import { McpAgentAssessment } from 'mcp-agent-assessment'

import { Validation } from '../task/Validation.mjs'


class AssessmentProbe {
    static async probe( { endpoint, timeout = 15000 } ) {
        const { status, messages } = Validation.validationProbe( { endpoint, timeout } )
        if( !status ) { Validation.error( { messages } ) }

        try {
            const assessment = await McpAgentAssessment.assess( { endpoint, timeout } )

            const { categories: assessCat, entries: assessEntries, messages: assessMessages } = assessment

            const mcpEntries = assessEntries[ 'mcp' ] || {}
            const a2aEntries = assessEntries[ 'a2a' ] || {}
            const assessmentData = assessEntries[ 'assessment' ] || {}

            const x402Data = mcpEntries[ 'x402' ] || null
            const x402ToolCount = x402Data !== null && Array.isArray( x402Data[ 'tools' ] ) ? x402Data[ 'tools' ].length : 0
            const networks = x402Data !== null && Array.isArray( x402Data[ 'networks' ] ) ? x402Data[ 'networks' ] : []
            const schemes = x402Data !== null && Array.isArray( x402Data[ 'schemes' ] ) ? x402Data[ 'schemes' ] : []

            const categories = {
                isReachable: assessCat[ 'isReachable' ] || false,
                supportsMcp: assessCat[ 'supportsMcp' ] || false,
                hasTools: assessCat[ 'hasTools' ] || false,
                hasResources: assessCat[ 'hasResources' ] || false,
                hasPrompts: assessCat[ 'hasPrompts' ] || false,
                supportsX402: assessCat[ 'supportsX402' ] || false,
                hasValidPaymentRequirements: assessCat[ 'hasValidPaymentRequirements' ] || false,
                supportsExactScheme: assessCat[ 'supportsExactScheme' ] || false,
                supportsEvm: assessCat[ 'supportsEvm' ] || false,
                supportsSolana: assessCat[ 'supportsSolana' ] || false,
                supportsTasks: assessCat[ 'supportsTasks' ] || false,
                supportsMcpApps: assessCat[ 'supportsMcpApps' ] || false,
                hasA2aCard: assessCat[ 'hasA2aCard' ] || false,
                hasA2aValidStructure: assessCat[ 'hasA2aValidStructure' ] || false,
                hasA2aSkills: assessCat[ 'hasA2aSkills' ] || false,
                supportsA2aStreaming: assessCat[ 'supportsA2aStreaming' ] || false
            }

            const summary = {
                serverName: mcpEntries[ 'serverName' ] || null,
                serverVersion: mcpEntries[ 'serverVersion' ] || null,
                toolCount: mcpEntries[ 'toolCount' ] || 0,
                resourceCount: mcpEntries[ 'resourceCount' ] || 0,
                promptCount: mcpEntries[ 'promptCount' ] || 0,
                x402ToolCount,
                networks,
                schemes,
                latencyPingMs: null,
                latencyListToolsMs: null,
                agentName: a2aEntries[ 'agentName' ] || null,
                skillCount: a2aEntries[ 'skillCount' ] || null,
                grade: assessmentData[ 'grade' ] || null,
                errorCount: assessmentData[ 'errorCount' ] || 0,
                warningCount: assessmentData[ 'warningCount' ] || 0
            }

            const probeResult = {
                timestamp: assessEntries[ 'timestamp' ] || new Date().toISOString(),
                status: assessment[ 'status' ],
                categories,
                summary,
                messages: assessMessages
            }

            return { probeResult }
        } catch( error ) {
            const probeResult = {
                timestamp: new Date().toISOString(),
                status: false,
                categories: {
                    isReachable: false,
                    supportsMcp: false,
                    hasTools: false,
                    hasResources: false,
                    hasPrompts: false,
                    supportsX402: false,
                    hasValidPaymentRequirements: false,
                    supportsExactScheme: false,
                    supportsEvm: false,
                    supportsSolana: false,
                    supportsTasks: false,
                    supportsMcpApps: false,
                    hasA2aCard: false,
                    hasA2aValidStructure: false,
                    hasA2aSkills: false,
                    supportsA2aStreaming: false
                },
                summary: {
                    serverName: null,
                    serverVersion: null,
                    toolCount: 0,
                    resourceCount: 0,
                    promptCount: 0,
                    x402ToolCount: 0,
                    networks: [],
                    schemes: [],
                    latencyPingMs: null,
                    latencyListToolsMs: null,
                    agentName: null,
                    skillCount: null,
                    grade: null,
                    errorCount: 0,
                    warningCount: 0
                },
                messages: [ error.message ]
            }

            return { probeResult }
        }
    }
}


export { AssessmentProbe }
