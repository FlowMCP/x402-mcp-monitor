import { jest } from '@jest/globals'


const mockAssess = jest.fn()

jest.unstable_mockModule( 'mcp-agent-assessment', () => ( {
    McpAgentAssessment: {
        assess: mockAssess
    }
} ) )

const { AssessmentProbe } = await import( '../../src/prober/AssessmentProbe.mjs' )


describe( 'AssessmentProbe', () => {
    afterEach( () => {
        mockAssess.mockReset()
    } )


    describe( 'probe', () => {
        test( 'returns probe result for healthy MCP server with x402', async () => {
            mockAssess.mockResolvedValue( {
                status: true,
                messages: [
                    { code: 'PRB-001', severity: 'INFO', layer: 1, location: 'tools', message: 'PRB-001 tools: Found 3 tools' }
                ],
                categories: {
                    isReachable: true,
                    supportsMcp: true,
                    hasTools: true,
                    hasResources: false,
                    hasPrompts: false,
                    supportsX402: true,
                    hasValidPaymentRequirements: true,
                    supportsExactScheme: true,
                    supportsEvm: true,
                    supportsSolana: false,
                    supportsTasks: false,
                    supportsMcpApps: false,
                    hasA2aCard: false,
                    hasA2aValidStructure: false,
                    hasA2aSkills: false,
                    supportsA2aStreaming: false,
                    overallHealthy: true
                },
                entries: {
                    endpoint: 'https://mcp.test.com/sse',
                    timestamp: '2026-02-07T10:00:00.000Z',
                    mcp: {
                        serverName: 'test-server',
                        serverVersion: '1.0.0',
                        toolCount: 3,
                        resourceCount: 0,
                        promptCount: 0,
                        tools: [ { name: 'tool1' }, { name: 'tool2' }, { name: 'tool3' } ],
                        resources: [],
                        prompts: [],
                        x402: {
                            tools: [ { name: 'paid-tool' } ],
                            networks: [ 'eip155:8453' ],
                            schemes: [ 'exact' ]
                        },
                        latency: 120
                    },
                    a2a: null,
                    erc8004: null,
                    reputation: null,
                    assessment: { errorCount: 0, warningCount: 0, infoCount: 1, grade: 'A' }
                },
                layers: {}
            } )

            const { probeResult } = await AssessmentProbe.probe( {
                endpoint: 'https://mcp.test.com/sse',
                timeout: 5000
            } )

            expect( probeResult[ 'status' ] ).toBe( true )
            expect( probeResult[ 'timestamp' ] ).toBe( '2026-02-07T10:00:00.000Z' )
            expect( probeResult[ 'categories' ][ 'isReachable' ] ).toBe( true )
            expect( probeResult[ 'categories' ][ 'supportsMcp' ] ).toBe( true )
            expect( probeResult[ 'categories' ][ 'hasTools' ] ).toBe( true )
            expect( probeResult[ 'categories' ][ 'supportsX402' ] ).toBe( true )
            expect( probeResult[ 'categories' ][ 'hasA2aCard' ] ).toBe( false )
            expect( probeResult[ 'summary' ][ 'serverName' ] ).toBe( 'test-server' )
            expect( probeResult[ 'summary' ][ 'toolCount' ] ).toBe( 3 )
            expect( probeResult[ 'summary' ][ 'x402ToolCount' ] ).toBe( 1 )
            expect( probeResult[ 'summary' ][ 'networks' ] ).toEqual( [ 'eip155:8453' ] )
            expect( probeResult[ 'summary' ][ 'schemes' ] ).toEqual( [ 'exact' ] )
            expect( probeResult[ 'summary' ][ 'grade' ] ).toBe( 'A' )
            expect( probeResult[ 'messages' ] ).toHaveLength( 1 )
        } )


        test( 'returns probe result with A2A data', async () => {
            mockAssess.mockResolvedValue( {
                status: true,
                messages: [],
                categories: {
                    isReachable: true,
                    supportsMcp: true,
                    hasTools: true,
                    hasResources: false,
                    hasPrompts: false,
                    supportsX402: false,
                    hasValidPaymentRequirements: false,
                    supportsExactScheme: false,
                    supportsEvm: false,
                    supportsSolana: false,
                    supportsTasks: false,
                    supportsMcpApps: false,
                    hasA2aCard: true,
                    hasA2aValidStructure: true,
                    hasA2aSkills: true,
                    supportsA2aStreaming: true,
                    overallHealthy: true
                },
                entries: {
                    endpoint: 'https://agent.test.com',
                    timestamp: '2026-02-07T10:00:00.000Z',
                    mcp: {
                        serverName: 'agent-server',
                        serverVersion: '2.0.0',
                        toolCount: 1,
                        resourceCount: 0,
                        promptCount: 0,
                        tools: [ { name: 'tool1' } ],
                        resources: [],
                        prompts: [],
                        x402: null,
                        latency: 80
                    },
                    a2a: {
                        agentName: 'Test Agent',
                        skillCount: 2,
                        skills: [ { id: 's1' }, { id: 's2' } ],
                        protocolBindings: [ 'JSONRPC' ],
                        provider: { organization: 'Test Org', url: null }
                    },
                    erc8004: null,
                    reputation: null,
                    assessment: { errorCount: 0, warningCount: 0, infoCount: 0, grade: 'A' }
                },
                layers: {}
            } )

            const { probeResult } = await AssessmentProbe.probe( {
                endpoint: 'https://agent.test.com',
                timeout: 5000
            } )

            expect( probeResult[ 'categories' ][ 'hasA2aCard' ] ).toBe( true )
            expect( probeResult[ 'categories' ][ 'hasA2aValidStructure' ] ).toBe( true )
            expect( probeResult[ 'categories' ][ 'hasA2aSkills' ] ).toBe( true )
            expect( probeResult[ 'categories' ][ 'supportsA2aStreaming' ] ).toBe( true )
            expect( probeResult[ 'summary' ][ 'agentName' ] ).toBe( 'Test Agent' )
            expect( probeResult[ 'summary' ][ 'skillCount' ] ).toBe( 2 )
        } )


        test( 'handles assessment failure gracefully', async () => {
            mockAssess.mockRejectedValue( new Error( 'Connection refused' ) )

            const { probeResult } = await AssessmentProbe.probe( {
                endpoint: 'https://dead.server.com/mcp',
                timeout: 5000
            } )

            expect( probeResult[ 'status' ] ).toBe( false )
            expect( probeResult[ 'categories' ][ 'isReachable' ] ).toBe( false )
            expect( probeResult[ 'categories' ][ 'supportsMcp' ] ).toBe( false )
            expect( probeResult[ 'categories' ][ 'hasA2aCard' ] ).toBe( false )
            expect( probeResult[ 'summary' ][ 'serverName' ] ).toBe( null )
            expect( probeResult[ 'summary' ][ 'grade' ] ).toBe( null )
            expect( probeResult[ 'messages' ] ).toEqual( [ 'Connection refused' ] )
        } )


        test( 'handles server without x402', async () => {
            mockAssess.mockResolvedValue( {
                status: true,
                messages: [],
                categories: {
                    isReachable: true,
                    supportsMcp: true,
                    hasTools: true,
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
                    supportsA2aStreaming: false,
                    overallHealthy: true
                },
                entries: {
                    endpoint: 'https://free.server.com/mcp',
                    timestamp: '2026-02-07T10:00:00.000Z',
                    mcp: {
                        serverName: 'basic-server',
                        serverVersion: '1.0.0',
                        toolCount: 1,
                        resourceCount: 0,
                        promptCount: 0,
                        tools: [ { name: 'free-tool' } ],
                        resources: [],
                        prompts: [],
                        x402: null,
                        latency: 50
                    },
                    a2a: null,
                    erc8004: null,
                    reputation: null,
                    assessment: { errorCount: 0, warningCount: 0, infoCount: 0, grade: 'A' }
                },
                layers: {}
            } )

            const { probeResult } = await AssessmentProbe.probe( {
                endpoint: 'https://free.server.com/mcp',
                timeout: 5000
            } )

            expect( probeResult[ 'status' ] ).toBe( true )
            expect( probeResult[ 'categories' ][ 'supportsX402' ] ).toBe( false )
            expect( probeResult[ 'summary' ][ 'x402ToolCount' ] ).toBe( 0 )
            expect( probeResult[ 'summary' ][ 'networks' ] ).toEqual( [] )
            expect( probeResult[ 'summary' ][ 'schemes' ] ).toEqual( [] )
        } )


        test( 'throws on missing endpoint', async () => {
            await expect(
                AssessmentProbe.probe( { timeout: 5000 } )
            ).rejects.toThrow( 'endpoint: Missing value' )
        } )


        test( 'throws on invalid timeout', async () => {
            await expect(
                AssessmentProbe.probe( { endpoint: 'https://test.com', timeout: -1 } )
            ).rejects.toThrow( 'timeout: Must be greater than 0' )
        } )
    } )
} )
