import { McpServerValidator } from 'x402-mcp-validator'

import { Validation } from '../task/Validation.mjs'


class McpProbe {
    static async probe( { endpoint, timeout = 15000 } ) {
        const { status, messages } = Validation.validationProbe( { endpoint, timeout } )
        if( !status ) { Validation.error( { messages } ) }

        try {
            const startPing = Date.now()
            const pingResponse = await fetch( endpoint, {
                method: 'HEAD',
                signal: AbortSignal.timeout( timeout )
            } ).catch( () => null )
            const latencyPingMs = Date.now() - startPing

            const startListTools = Date.now()
            const { status: validatorStatus, messages: validatorMessages, categories: validatorCategories, entries } = await McpServerValidator.start( {
                endpoint,
                timeout
            } )
            const latencyListToolsMs = Date.now() - startListTools

            const isReachable = pingResponse !== null || validatorStatus
            const supportsMcp = validatorStatus
            const hasTools = entries !== null && entries[ 'tools' ] !== undefined && entries[ 'tools' ].length > 0
            const hasResources = entries !== null && entries[ 'resources' ] !== undefined && entries[ 'resources' ].length > 0
            const hasPrompts = entries !== null && entries[ 'prompts' ] !== undefined && entries[ 'prompts' ].length > 0

            const x402Data = entries !== null ? entries[ 'x402' ] : null
            const supportsX402 = validatorCategories !== null && validatorCategories[ 'supportsX402' ] === true
            const hasValidPaymentRequirements = validatorCategories !== null && validatorCategories[ 'hasValidPaymentRequirements' ] === true
            const supportsExactScheme = validatorCategories !== null && validatorCategories[ 'supportsExactScheme' ] === true
            const supportsEvm = validatorCategories !== null && validatorCategories[ 'supportsEvm' ] === true
            const supportsSolana = validatorCategories !== null && validatorCategories[ 'supportsSolana' ] === true

            const categories = {
                isReachable,
                supportsMcp,
                hasTools,
                hasResources,
                hasPrompts,
                supportsX402,
                hasValidPaymentRequirements,
                supportsExactScheme,
                supportsEvm,
                supportsSolana
            }

            const toolCount = hasTools ? entries[ 'tools' ].length : 0
            const resourceCount = hasResources ? entries[ 'resources' ].length : 0
            const promptCount = hasPrompts ? entries[ 'prompts' ].length : 0
            const x402ToolCount = x402Data !== null && x402Data[ 'tools' ] !== undefined ? x402Data[ 'tools' ].length : 0
            const networks = x402Data !== null && x402Data[ 'networks' ] !== undefined ? x402Data[ 'networks' ] : []
            const schemes = x402Data !== null && x402Data[ 'schemes' ] !== undefined ? x402Data[ 'schemes' ] : []

            const summary = {
                serverName: entries !== null ? entries[ 'serverName' ] : null,
                serverVersion: entries !== null ? entries[ 'serverVersion' ] : null,
                toolCount,
                resourceCount,
                promptCount,
                x402ToolCount,
                networks,
                schemes,
                latencyPingMs,
                latencyListToolsMs
            }

            const probeResult = {
                timestamp: new Date().toISOString(),
                status: validatorStatus,
                categories,
                summary,
                messages: validatorMessages
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
                    supportsSolana: false
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
                    latencyListToolsMs: null
                },
                messages: [ error.message ]
            }

            return { probeResult }
        }
    }
}


export { McpProbe }
