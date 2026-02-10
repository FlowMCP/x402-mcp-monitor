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
                    isHttpReachable: true,
                    isHttps: true,
                    hasValidSsl: true,
                    hasSslCertificate: true,
                    hasRedirects: false,
                    isWebsite: false,
                    isApiEndpoint: false,
                    hasServerHeader: true,
                    supportsCors: false,
                    supportsHttp2: true,
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
                    supportsLogging: false,
                    supportsCompletions: false,
                    supportsResourceSubscription: false,
                    supportsResourceListChanged: false,
                    supportsPromptListChanged: false,
                    supportsToolListChanged: false,
                    supportsTaskList: false,
                    supportsTaskCancel: false,
                    supportsTaskAugmentedToolCall: false,
                    hasExperimentalCapabilities: false,
                    specVersion: '2025-03-26',
                    supportsA2aAp2: false,
                    hasA2aErc8004ServiceLink: false,
                    overallHealthy: true
                },
                entries: {
                    endpoint: 'https://mcp.test.com/sse',
                    timestamp: '2026-02-07T10:00:00.000Z',
                    http: {
                        protocol: 'https',
                        statusCode: 200,
                        redirectCount: 0,
                        redirectChain: [],
                        contentType: 'application/json',
                        serverHeader: 'nginx',
                        responseTimeMs: 85,
                        sslProtocol: 'TLSv1.3',
                        sslIssuer: 'Let\'s Encrypt',
                        sslExpiresAt: '2027-01-01T00:00:00.000Z',
                        ipAddress: '93.184.216.34'
                    },
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
                        latency: 120,
                        specVersion: '2025-03-26',
                        experimentalCapabilities: null,
                        taskCapabilities: null
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
            expect( probeResult[ 'categories' ][ 'isHttpReachable' ] ).toBe( true )
            expect( probeResult[ 'categories' ][ 'isHttps' ] ).toBe( true )
            expect( probeResult[ 'categories' ][ 'hasValidSsl' ] ).toBe( true )
            expect( probeResult[ 'categories' ][ 'supportsHttp2' ] ).toBe( true )
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
            expect( probeResult[ 'summary' ][ 'specVersion' ] ).toBe( '2025-03-26' )
            expect( probeResult[ 'summary' ][ 'httpStatusCode' ] ).toBe( 200 )
            expect( probeResult[ 'summary' ][ 'httpResponseTimeMs' ] ).toBe( 85 )
            expect( probeResult[ 'summary' ][ 'httpProtocol' ] ).toBe( 'https' )
            expect( probeResult[ 'categories' ][ 'specVersion' ] ).toBe( '2025-03-26' )
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
                    supportsLogging: false,
                    supportsCompletions: false,
                    supportsResourceSubscription: false,
                    supportsResourceListChanged: false,
                    supportsPromptListChanged: false,
                    supportsToolListChanged: false,
                    supportsTaskList: false,
                    supportsTaskCancel: false,
                    supportsTaskAugmentedToolCall: false,
                    hasExperimentalCapabilities: false,
                    specVersion: null,
                    supportsA2aAp2: true,
                    hasA2aErc8004ServiceLink: false,
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
                        provider: { organization: 'Test Org', url: null },
                        ap2Version: '1.0',
                        erc8004ServiceUrl: null,
                        extensions: 'ap2=https://github.com/google-agentic-commerce/AP2/v1.0'
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
            expect( probeResult[ 'categories' ][ 'supportsA2aAp2' ] ).toBe( true )
            expect( probeResult[ 'summary' ][ 'ap2Version' ] ).toBe( '1.0' )
        } )


        test( 'handles assessment failure gracefully', async () => {
            mockAssess.mockRejectedValue( new Error( 'Connection refused' ) )

            const { probeResult } = await AssessmentProbe.probe( {
                endpoint: 'https://dead.server.com/mcp',
                timeout: 5000
            } )

            expect( probeResult[ 'status' ] ).toBe( false )
            expect( probeResult[ 'categories' ][ 'isHttpReachable' ] ).toBe( false )
            expect( probeResult[ 'categories' ][ 'isHttps' ] ).toBe( false )
            expect( probeResult[ 'categories' ][ 'isReachable' ] ).toBe( false )
            expect( probeResult[ 'categories' ][ 'supportsMcp' ] ).toBe( false )
            expect( probeResult[ 'categories' ][ 'hasA2aCard' ] ).toBe( false )
            expect( probeResult[ 'summary' ][ 'serverName' ] ).toBe( null )
            expect( probeResult[ 'summary' ][ 'grade' ] ).toBe( null )
            expect( probeResult[ 'summary' ][ 'httpStatusCode' ] ).toBe( null )
            expect( probeResult[ 'summary' ][ 'httpProtocol' ] ).toBe( null )
            expect( probeResult[ 'categories' ][ 'supportsLogging' ] ).toBe( false )
            expect( probeResult[ 'categories' ][ 'specVersion' ] ).toBe( null )
            expect( probeResult[ 'categories' ][ 'supportsA2aAp2' ] ).toBe( false )
            expect( probeResult[ 'summary' ][ 'specVersion' ] ).toBe( null )
            expect( probeResult[ 'summary' ][ 'ap2Version' ] ).toBe( null )
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
                    supportsLogging: false,
                    supportsCompletions: false,
                    supportsResourceSubscription: false,
                    supportsResourceListChanged: false,
                    supportsPromptListChanged: false,
                    supportsToolListChanged: false,
                    supportsTaskList: false,
                    supportsTaskCancel: false,
                    supportsTaskAugmentedToolCall: false,
                    hasExperimentalCapabilities: false,
                    specVersion: null,
                    supportsA2aAp2: false,
                    hasA2aErc8004ServiceLink: false,
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


        test( 'returns new MCP capabilities in probe result', async () => {
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
                    supportsLogging: true,
                    supportsCompletions: true,
                    supportsResourceSubscription: false,
                    supportsResourceListChanged: false,
                    supportsPromptListChanged: false,
                    supportsToolListChanged: false,
                    supportsTaskList: false,
                    supportsTaskCancel: false,
                    supportsTaskAugmentedToolCall: false,
                    hasExperimentalCapabilities: true,
                    specVersion: '2025-03-26',
                    supportsA2aAp2: false,
                    hasA2aErc8004ServiceLink: false,
                    overallHealthy: true
                },
                entries: {
                    endpoint: 'https://capable.server.com/mcp',
                    timestamp: '2026-02-07T10:00:00.000Z',
                    mcp: {
                        serverName: 'capable-server',
                        serverVersion: '3.0.0',
                        toolCount: 5,
                        resourceCount: 0,
                        promptCount: 0,
                        tools: [ { name: 't1' }, { name: 't2' }, { name: 't3' }, { name: 't4' }, { name: 't5' } ],
                        resources: [],
                        prompts: [],
                        x402: null,
                        latency: 60,
                        specVersion: '2025-03-26',
                        experimentalCapabilities: { customFeature: true },
                        taskCapabilities: null
                    },
                    a2a: null,
                    erc8004: null,
                    reputation: null,
                    assessment: { errorCount: 0, warningCount: 0, infoCount: 0, grade: 'A' }
                },
                layers: {}
            } )

            const { probeResult } = await AssessmentProbe.probe( {
                endpoint: 'https://capable.server.com/mcp',
                timeout: 5000
            } )

            expect( probeResult[ 'categories' ][ 'supportsLogging' ] ).toBe( true )
            expect( probeResult[ 'categories' ][ 'supportsCompletions' ] ).toBe( true )
            expect( probeResult[ 'categories' ][ 'hasExperimentalCapabilities' ] ).toBe( true )
            expect( probeResult[ 'categories' ][ 'specVersion' ] ).toBe( '2025-03-26' )
            expect( probeResult[ 'categories' ][ 'supportsResourceSubscription' ] ).toBe( false )
            expect( probeResult[ 'categories' ][ 'supportsTaskList' ] ).toBe( false )
            expect( probeResult[ 'categories' ][ 'supportsA2aAp2' ] ).toBe( false )
            expect( probeResult[ 'categories' ][ 'hasA2aErc8004ServiceLink' ] ).toBe( false )
            expect( probeResult[ 'summary' ][ 'specVersion' ] ).toBe( '2025-03-26' )
            expect( probeResult[ 'summary' ][ 'ap2Version' ] ).toBe( null )
            expect( probeResult[ 'summary' ][ 'erc8004ServiceUrl' ] ).toBe( null )
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
