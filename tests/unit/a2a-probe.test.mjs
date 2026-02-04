import { jest } from '@jest/globals'


const mockValidatorStart = jest.fn()

jest.unstable_mockModule( 'a2a-agent-validator', () => ( {
    A2aAgentValidator: {
        start: mockValidatorStart
    }
} ) )

const { A2aProbe } = await import( '../../src/prober/A2aProbe.mjs' )


describe( 'A2aProbe', () => {
    afterEach( () => {
        mockValidatorStart.mockReset()
    } )


    describe( 'probe', () => {
        test( 'returns probe result for healthy A2A agent', async () => {
            mockValidatorStart.mockResolvedValue( {
                status: true,
                messages: [],
                categories: {
                    supportsStreaming: true,
                    supportsPushNotifications: false,
                    supportsExtendedCard: false
                },
                entries: {
                    agentName: 'Test Agent',
                    skills: [ { id: 's1', name: 'Skill 1' }, { id: 's2', name: 'Skill 2' } ],
                    protocolBindings: [ 'JSONRPC' ]
                }
            } )

            const { probeResult } = await A2aProbe.probe( {
                endpoint: 'https://agent.test.com',
                timeout: 5000
            } )

            expect( probeResult[ 'status' ] ).toBe( true )
            expect( probeResult[ 'categories' ][ 'isReachable' ] ).toBe( true )
            expect( probeResult[ 'categories' ][ 'hasSkills' ] ).toBe( true )
            expect( probeResult[ 'categories' ][ 'supportsStreaming' ] ).toBe( true )
            expect( probeResult[ 'summary' ][ 'agentName' ] ).toBe( 'Test Agent' )
            expect( probeResult[ 'summary' ][ 'skillCount' ] ).toBe( 2 )
            expect( probeResult[ 'summary' ][ 'protocolBindings' ] ).toEqual( [ 'JSONRPC' ] )
        } )


        test( 'handles unreachable agent', async () => {
            mockValidatorStart.mockRejectedValue( new Error( 'Connection refused' ) )

            const { probeResult } = await A2aProbe.probe( {
                endpoint: 'https://dead.agent.com',
                timeout: 5000
            } )

            expect( probeResult[ 'status' ] ).toBe( false )
            expect( probeResult[ 'categories' ][ 'isReachable' ] ).toBe( false )
            expect( probeResult[ 'messages' ] ).toHaveLength( 1 )
        } )


        test( 'handles agent without skills', async () => {
            mockValidatorStart.mockResolvedValue( {
                status: true,
                messages: [],
                categories: {
                    supportsStreaming: false,
                    supportsPushNotifications: false,
                    supportsExtendedCard: false
                },
                entries: {
                    agentName: 'Empty Agent',
                    skills: [],
                    protocolBindings: []
                }
            } )

            const { probeResult } = await A2aProbe.probe( {
                endpoint: 'https://empty.agent.com',
                timeout: 5000
            } )

            expect( probeResult[ 'status' ] ).toBe( true )
            expect( probeResult[ 'categories' ][ 'hasSkills' ] ).toBe( false )
            expect( probeResult[ 'summary' ][ 'skillCount' ] ).toBe( 0 )
        } )


        test( 'throws on missing endpoint', async () => {
            await expect(
                A2aProbe.probe( { timeout: 5000 } )
            ).rejects.toThrow( 'endpoint: Missing value' )
        } )
    } )
} )
