import { jest } from '@jest/globals'


const mockMcpProbe = jest.fn()
const mockA2aProbe = jest.fn()

jest.unstable_mockModule( '../../src/prober/McpProbe.mjs', () => ( {
    McpProbe: {
        probe: mockMcpProbe
    }
} ) )

jest.unstable_mockModule( '../../src/prober/A2aProbe.mjs', () => ( {
    A2aProbe: {
        probe: mockA2aProbe
    }
} ) )

const { EndpointProber } = await import( '../../src/prober/EndpointProber.mjs' )


const MOCK_PROBE_RESULT = {
    timestamp: '2026-02-04T12:00:00.000Z',
    status: true,
    categories: { isReachable: true },
    summary: { serverName: 'test' },
    messages: []
}


describe( 'EndpointProber', () => {
    afterEach( () => {
        mockMcpProbe.mockReset()
        mockA2aProbe.mockReset()
    } )


    describe( 'probeAll', () => {
        test( 'probes new endpoints without existing probe', async () => {
            mockMcpProbe.mockResolvedValue( { probeResult: MOCK_PROBE_RESULT } )

            const endpoints = [
                { id: 'ep_1', url: 'https://test.com/mcp', protocol: 'mcp', sources: [], probe: null }
            ]

            const { endpoints: result, probedCount } = await EndpointProber.probeAll( {
                endpoints,
                maxConcurrency: 2,
                timeout: 5000,
                probeMaxAgeDays: 7
            } )

            expect( probedCount ).toBe( 1 )
            expect( result[ 0 ][ 'probe' ] ).toEqual( MOCK_PROBE_RESULT )
            expect( mockMcpProbe ).toHaveBeenCalledTimes( 1 )
        } )


        test( 'skips fresh probes', async () => {
            const endpoints = [
                {
                    id: 'ep_1',
                    url: 'https://test.com/mcp',
                    protocol: 'mcp',
                    sources: [],
                    probe: {
                        timestamp: new Date().toISOString(),
                        status: true,
                        categories: {},
                        summary: {},
                        messages: []
                    }
                }
            ]

            const { probedCount } = await EndpointProber.probeAll( {
                endpoints,
                maxConcurrency: 2,
                timeout: 5000,
                probeMaxAgeDays: 7
            } )

            expect( probedCount ).toBe( 0 )
            expect( mockMcpProbe ).not.toHaveBeenCalled()
        } )


        test( 'reprobes stale endpoints', async () => {
            mockMcpProbe.mockResolvedValue( { probeResult: MOCK_PROBE_RESULT } )

            const staleTimestamp = new Date( Date.now() - 8 * 24 * 60 * 60 * 1000 ).toISOString()

            const endpoints = [
                {
                    id: 'ep_1',
                    url: 'https://test.com/mcp',
                    protocol: 'mcp',
                    sources: [],
                    probe: {
                        timestamp: staleTimestamp,
                        status: true,
                        categories: {},
                        summary: {},
                        messages: []
                    }
                }
            ]

            const { probedCount } = await EndpointProber.probeAll( {
                endpoints,
                maxConcurrency: 2,
                timeout: 5000,
                probeMaxAgeDays: 7
            } )

            expect( probedCount ).toBe( 1 )
            expect( mockMcpProbe ).toHaveBeenCalledTimes( 1 )
        } )


        test( 'uses A2aProbe for a2a protocol', async () => {
            mockA2aProbe.mockResolvedValue( { probeResult: MOCK_PROBE_RESULT } )

            const endpoints = [
                { id: 'ep_1', url: 'https://agent.test.com', protocol: 'a2a', sources: [], probe: null }
            ]

            const { probedCount } = await EndpointProber.probeAll( {
                endpoints,
                maxConcurrency: 2,
                timeout: 5000,
                probeMaxAgeDays: 7
            } )

            expect( probedCount ).toBe( 1 )
            expect( mockA2aProbe ).toHaveBeenCalledTimes( 1 )
            expect( mockMcpProbe ).not.toHaveBeenCalled()
        } )


        test( 'respects concurrency limit', async () => {
            let concurrentCount = 0
            let maxConcurrent = 0

            mockMcpProbe.mockImplementation( async () => {
                concurrentCount += 1
                maxConcurrent = Math.max( maxConcurrent, concurrentCount )
                await new Promise( ( resolve ) => setTimeout( resolve, 50 ) )
                concurrentCount -= 1

                return { probeResult: MOCK_PROBE_RESULT }
            } )

            const endpoints = Array.from( { length: 10 } )
                .map( ( _, i ) => ( {
                    id: `ep_${i}`,
                    url: `https://test${i}.com/mcp`,
                    protocol: 'mcp',
                    sources: [],
                    probe: null
                } ) )

            await EndpointProber.probeAll( {
                endpoints,
                maxConcurrency: 3,
                timeout: 5000,
                probeMaxAgeDays: 7
            } )

            expect( maxConcurrent ).toBeLessThanOrEqual( 3 )
        } )


        test( 'handles probe failures gracefully', async () => {
            mockMcpProbe.mockRejectedValue( new Error( 'Unexpected' ) )

            const endpoints = [
                { id: 'ep_1', url: 'https://test.com/mcp', protocol: 'mcp', sources: [], probe: null }
            ]

            const { endpoints: result, probedCount } = await EndpointProber.probeAll( {
                endpoints,
                maxConcurrency: 2,
                timeout: 5000,
                probeMaxAgeDays: 7
            } )

            expect( probedCount ).toBe( 1 )
            expect( result[ 0 ][ 'probe' ][ 'status' ] ).toBe( false )
        } )


        test( 'throws on missing endpoints', async () => {
            await expect(
                EndpointProber.probeAll( { maxConcurrency: 2, timeout: 5000, probeMaxAgeDays: 7 } )
            ).rejects.toThrow( 'endpoints: Missing value' )
        } )
    } )
} )
