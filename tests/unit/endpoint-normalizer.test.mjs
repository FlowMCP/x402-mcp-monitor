import { EndpointNormalizer } from '../../src/registry/EndpointNormalizer.mjs'


describe( 'EndpointNormalizer', () => {
    describe( 'normalizeUrl', () => {
        test( 'lowercases hostname', () => {
            const { normalizedUrl } = EndpointNormalizer.normalizeUrl( { url: 'https://MCP.EXAMPLE.COM/path' } )

            expect( normalizedUrl ).toBe( 'https://mcp.example.com/path' )
        } )


        test( 'removes trailing slashes', () => {
            const { normalizedUrl } = EndpointNormalizer.normalizeUrl( { url: 'https://mcp.example.com/path/' } )

            expect( normalizedUrl ).toBe( 'https://mcp.example.com/path' )
        } )


        test( 'removes multiple trailing slashes', () => {
            const { normalizedUrl } = EndpointNormalizer.normalizeUrl( { url: 'https://mcp.example.com///' } )

            expect( normalizedUrl ).toBe( 'https://mcp.example.com' )
        } )


        test( 'preserves port numbers', () => {
            const { normalizedUrl } = EndpointNormalizer.normalizeUrl( { url: 'https://mcp.example.com:8443/mcp' } )

            expect( normalizedUrl ).toBe( 'https://mcp.example.com:8443/mcp' )
        } )


        test( 'preserves query strings', () => {
            const { normalizedUrl } = EndpointNormalizer.normalizeUrl( { url: 'https://mcp.example.com/mcp?key=value' } )

            expect( normalizedUrl ).toBe( 'https://mcp.example.com/mcp?key=value' )
        } )


        test( 'lowercases protocol', () => {
            const { normalizedUrl } = EndpointNormalizer.normalizeUrl( { url: 'HTTPS://mcp.example.com/path' } )

            expect( normalizedUrl ).toBe( 'https://mcp.example.com/path' )
        } )


        test( 'handles url without path', () => {
            const { normalizedUrl } = EndpointNormalizer.normalizeUrl( { url: 'https://mcp.example.com' } )

            expect( normalizedUrl ).toBe( 'https://mcp.example.com' )
        } )


        test( 'throws on missing url', () => {
            expect( () => {
                EndpointNormalizer.normalizeUrl( {} )
            } ).toThrow( 'url: Missing value' )
        } )


        test( 'throws on non-string url', () => {
            expect( () => {
                EndpointNormalizer.normalizeUrl( { url: 123 } )
            } ).toThrow( 'url: Must be a string' )
        } )


        test( 'throws on empty url', () => {
            expect( () => {
                EndpointNormalizer.normalizeUrl( { url: '  ' } )
            } ).toThrow( 'url: Must not be empty' )
        } )
    } )


    describe( 'generateId', () => {
        test( 'generates deterministic id from url', () => {
            const { id: id1 } = EndpointNormalizer.generateId( { url: 'https://mcp.example.com/mcp' } )
            const { id: id2 } = EndpointNormalizer.generateId( { url: 'https://mcp.example.com/mcp' } )

            expect( id1 ).toBe( id2 )
        } )


        test( 'generates id with ep_ prefix', () => {
            const { id } = EndpointNormalizer.generateId( { url: 'https://mcp.example.com/mcp' } )

            expect( id ).toMatch( /^ep_[a-f0-9]{8}$/ )
        } )


        test( 'generates same id for equivalent urls', () => {
            const { id: id1 } = EndpointNormalizer.generateId( { url: 'https://MCP.EXAMPLE.COM/mcp/' } )
            const { id: id2 } = EndpointNormalizer.generateId( { url: 'https://mcp.example.com/mcp' } )

            expect( id1 ).toBe( id2 )
        } )


        test( 'generates different ids for different urls', () => {
            const { id: id1 } = EndpointNormalizer.generateId( { url: 'https://mcp.example.com/a' } )
            const { id: id2 } = EndpointNormalizer.generateId( { url: 'https://mcp.example.com/b' } )

            expect( id1 ).not.toBe( id2 )
        } )


        test( 'throws on missing url', () => {
            expect( () => {
                EndpointNormalizer.generateId( {} )
            } ).toThrow( 'url: Missing value' )
        } )
    } )
} )
