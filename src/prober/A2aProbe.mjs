import { A2aAgentValidator } from 'a2a-agent-validator'

import { Validation } from '../task/Validation.mjs'


class A2aProbe {
    static async probe( { endpoint, timeout = 15000 } ) {
        const { status, messages } = Validation.validationProbe( { endpoint, timeout } )
        if( !status ) { Validation.error( { messages } ) }

        try {
            const startTime = Date.now()
            const { status: validatorStatus, messages: validatorMessages, categories: validatorCategories, entries } = await A2aAgentValidator.start( {
                endpoint,
                timeout
            } )
            const latencyMs = Date.now() - startTime

            const isReachable = validatorStatus
            const hasAgentCard = validatorStatus
            const hasValidStructure = validatorStatus
            const hasSkills = entries !== null && entries[ 'skills' ] !== undefined && entries[ 'skills' ].length > 0
            const supportsStreaming = validatorCategories !== null && validatorCategories[ 'supportsStreaming' ] === true

            const categories = {
                isReachable,
                hasAgentCard,
                hasValidStructure,
                hasSkills,
                supportsStreaming
            }

            const skillCount = hasSkills ? entries[ 'skills' ].length : 0
            const protocolBindings = entries !== null && entries[ 'protocolBindings' ] !== undefined ? entries[ 'protocolBindings' ] : []

            const summary = {
                agentName: entries !== null ? entries[ 'agentName' ] : null,
                skillCount,
                protocolBindings,
                latencyMs
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
                    hasAgentCard: false,
                    hasValidStructure: false,
                    hasSkills: false,
                    supportsStreaming: false
                },
                summary: {
                    agentName: null,
                    skillCount: 0,
                    protocolBindings: [],
                    latencyMs: null
                },
                messages: [ error.message ]
            }

            return { probeResult }
        }
    }
}


export { A2aProbe }
