import Hls from '../../../src/hls';
import { Events } from '../../../src/events';
import { ErrorDetails } from '../../../src/errors';
import type { ErrorData } from '../../../src/types/events';

import * as sinon from 'sinon';
import * as chai from 'chai';
import * as sinonChai from 'sinon-chai';
// import { multivariantPlaylistWithRedundantFallbacks } from './level-controller';

chai.use(sinonChai);
const expect = chai.expect;

describe('ErrorController Integration Tests', function () {
  let server;
  let clock;
  let hls: Hls;

  beforeEach(function () {
    server = sinon.fakeServer.create();
    setupMockServerResponses(server);
    clock = sinon.useFakeTimers({ shouldClearNativeTimers: true } as any);
    // Enable debug to catch callback errors:
    // hls = new Hls({ debug: true });
    hls = new Hls();
    sinon.spy(hls, 'stopLoad');
    sinon.spy(hls, 'trigger');
  });

  afterEach(function () {
    server.restore();
    clock.restore();
    hls.destroy();
  });

  describe('Multivariant Playlist Error Handling', function () {
    it('Manifest Parsing Errors are fatal and stop all network operations', function () {
      hls.loadSource('noEXTM3U.m3u8');
      hls.stopLoad.should.have.been.calledOnce;
      return new Promise((resolve, reject) => {
        hls.on(Events.ERROR, (event, data) => resolve(data));
        hls.on(Events.MANIFEST_LOADED, (event, data) =>
          reject(
            new Error(
              'Manifest Loaded should not be triggered when manifest parsing fails'
            )
          )
        );
        server.respond();
      }).then(
        expectFatalErrorEventToStopPlayer(
          hls,
          ErrorDetails.MANIFEST_PARSING_ERROR,
          'no EXTM3U delimiter'
        )
      );
    });

    it('Manifest Parsing Errors (no variants) are fatal and stop all network operations', function () {
      hls.loadSource('noLevels.m3u8');
      hls.stopLoad.should.have.been.calledOnce;
      return new Promise((resolve, reject) => {
        hls.on(Events.ERROR, (event, data) => resolve(data));
        hls.on(Events.MANIFEST_LOADED, (event, data) =>
          reject(
            new Error(
              'Manifest Loaded should not be triggered when manifest parsing fails'
            )
          )
        );
        server.respond();
      }).then(
        expectFatalErrorEventToStopPlayer(
          hls,
          ErrorDetails.MANIFEST_PARSING_ERROR,
          'no levels found in manifest'
        )
      );
    });

    it('Manifest Parsing Errors (Variable Substitution) are fatal and stop all network operations', function () {
      hls.loadSource('varSubErrorMultivariantPlaylist.m3u8');
      hls.stopLoad.should.have.been.calledOnce;
      return new Promise((resolve, reject) => {
        hls.on(Events.ERROR, (event, data) => resolve(data));
        hls.on(Events.MANIFEST_LOADED, (event, data) =>
          reject(
            new Error(
              'Manifest Loaded should not be triggered when manifest parsing fails'
            )
          )
        );
        server.respond();
      }).then(
        expectFatalErrorEventToStopPlayer(
          hls,
          ErrorDetails.MANIFEST_PARSING_ERROR,
          'Missing preceding EXT-X-DEFINE tag for Variable Reference: "foobar"'
        )
      );
    });

    it('Manifest Incompatible Codecs Errors are fatal and stop all network operations', function () {
      hls.loadSource('noCompatCodecs.m3u8');
      hls.stopLoad.should.have.been.calledOnce;
      return new Promise((resolve, reject) => {
        hls.on(Events.ERROR, (event, data) => resolve(data));
        hls.on(Events.MANIFEST_PARSED, (event, data) =>
          reject(
            new Error(
              'Manifest Parsed should not be triggered when manifest parsing fails'
            )
          )
        );
        server.respond();
      }).then(
        expectFatalErrorEventToStopPlayer(
          hls,
          ErrorDetails.MANIFEST_INCOMPATIBLE_CODECS_ERROR,
          'no level with compatible codecs found in manifest'
        )
      );
    });

    it('Manifest HTTP Load Errors are fatal and stop all network operations', function () {
      server.respondWith('http400.m3u8', [400, {}, ``]);
      hls.loadSource('http400.m3u8');
      hls.stopLoad.should.have.been.calledOnce;
      return new Promise((resolve, reject) => {
        hls.on(Events.ERROR, (event, data) => resolve(data));
        hls.on(Events.MANIFEST_PARSED, (event, data) =>
          reject(
            new Error(
              'Manifest Parsed should not be triggered when manifest parsing fails'
            )
          )
        );
        server.respond();
      }).then(
        expectFatalErrorEventToStopPlayer(
          hls,
          ErrorDetails.MANIFEST_LOAD_ERROR,
          'A network error occurred while loading manifest'
        )
      );
    });

    it('Manifest Load Timeout Errors are fatal and stop all network operations', function () {
      hls.loadSource('timeout.m3u8');
      hls.stopLoad.should.have.been.calledOnce;
      return new Promise((resolve, reject) => {
        hls.on(Events.ERROR, (event, data) => resolve(data));
        hls.on(Events.MANIFEST_PARSED, (event, data) =>
          reject(
            new Error(
              'Manifest Parsed should not be triggered when manifest parsing fails'
            )
          )
        );
        clock.tick(20000);
      }).then(
        expectFatalErrorEventToStopPlayer(
          hls,
          ErrorDetails.MANIFEST_LOAD_TIMEOUT,
          'A network timeout occurred while loading manifest'
        )
      );
    });
  });

  describe('Variant Media Playlist (no Multivariant Loaded) Error Handling', function () {
    it('Level Parsing Errors (Variable Substitution) are escalated to fatal when no switch options are present', function () {
      hls.loadSource('varSubErrorMediaPlaylist.m3u8');
      hls.stopLoad.should.have.been.calledOnce;
      return new Promise((resolve, reject) => {
        hls.on(Events.ERROR, (event, data) => resolve(data));
        hls.on(Events.LEVEL_LOADED, () =>
          reject(
            new Error(
              'Level Loaded should not be triggered when playlist parsing fails'
            )
          )
        );
        server.respond();
      }).then(
        expectFatalErrorEventToStopPlayer(
          hls,
          ErrorDetails.LEVEL_PARSING_ERROR,
          'Missing preceding EXT-X-DEFINE tag for Variable Reference: "foobar"'
        )
      );
    });

    it('Level Parsing Errors (Missing Target Duration) are escalated to fatal when no switch options are present', function () {
      hls.loadSource('noTargetDuration.m3u8');
      hls.stopLoad.should.have.been.calledOnce;
      return new Promise((resolve, reject) => {
        hls.on(Events.ERROR, (event, data) => resolve(data));
        hls.on(Events.LEVEL_LOADED, () =>
          reject(
            new Error(
              'Level Loaded should not be triggered when playlist parsing fails'
            )
          )
        );
        server.respond();
      }).then(
        expectFatalErrorEventToStopPlayer(
          hls,
          ErrorDetails.LEVEL_PARSING_ERROR,
          'Missing Target Duration'
        )
      );
    });

    it('Level Empty Errors (No Segments) are escalated to fatal when no switch options are present and Playlist is VOD', function () {
      hls.loadSource('noSegmentsVod.m3u8');
      hls.stopLoad.should.have.been.calledOnce;
      return new Promise((resolve, reject) => {
        hls.on(Events.ERROR, (event, data) => resolve(data));
        hls.on(Events.LEVEL_LOADED, () =>
          reject(
            new Error(
              'Level Loaded should not be triggered when playlist parsing fails'
            )
          )
        );
        server.respond();
      }).then(
        expectFatalErrorEventToStopPlayer(
          hls,
          ErrorDetails.LEVEL_EMPTY_ERROR,
          'No Segments found in Playlist'
        )
      );
    });

    it('Level Empty Errors (No Segments) are not fatal when Playlist with no switch options is Live', function () {
      hls.loadSource('noSegmentsLive.m3u8');
      return new Promise((resolve, reject) => {
        hls.on(Events.ERROR, (event, data) => resolve(data));
        hls.on(Events.LEVEL_LOADED, () =>
          reject(
            new Error(
              'Level Loaded should not be triggered when playlist parsing fails'
            )
          )
        );
        server.respond();
      }).then((data: ErrorData) => {
        expect(data.details).to.equal(ErrorDetails.LEVEL_EMPTY_ERROR);
        expect(data.fatal).to.equal(false, 'Error should not be fatal');
        expect(data.error.message).to.equal(
          'No Segments found in Playlist',
          data.error.message
        );
        hls.stopLoad.should.have.been.calledOnce;
        hls.trigger.should.not.have.been.calledWith(Events.LEVEL_LOADED);
        server.respondWith('noSegmentsLive.m3u8', [
          200,
          {},
          testResponses['oneSegmentLive.m3u8'],
        ]);
        clock.tick(6000);
        server.respond();
        hls.trigger.should.have.been.calledWith(Events.LEVEL_LOADED);
      });
    });
  });

  describe('Multivariant Media Playlist Error Handling', function () {
    it('Level Parsing Errors (Missing Target Duration) are not fatal when switch options are present', function () {
      hls.loadSource('multivariantPlaylist.m3u8');
      let errorIndex = -1;
      hls.once(Events.LEVEL_LOADING, (event, data) => {
        errorIndex = data.level;
        server.respondWith(data.url, [
          200,
          {},
          testResponses['noTargetDuration.m3u8'],
        ]);
      });
      hls.on(Events.LEVEL_LOADING, (event, data) => {
        server.respond();
      });
      return new Promise((resolve) => {
        hls.on(Events.ERROR, (event, data) => resolve(data));
        server.respond();
      }).then((data: ErrorData) => {
        expect(data.details).to.equal(ErrorDetails.LEVEL_PARSING_ERROR);
        expect(data.fatal).to.equal(false, 'Error should not be fatal');
        expect(data.error.message).to.equal(
          'Missing Target Duration',
          data.error.message
        );
        hls.stopLoad.should.have.been.calledOnce;
        hls.trigger.should.have.been.calledWith(Events.LEVEL_LOADED);
        expect(hls.currentLevel).to.not.equal(
          errorIndex,
          'Should not be on errored level'
        );
      });
    });

    it('Level HTTP Load Errors are not fatal when switch options are present', function () {
      hls.loadSource('multivariantPlaylist.m3u8');
      let errorIndex = -1;
      hls.once(Events.LEVEL_LOADING, (event, data) => {
        errorIndex = data.level;
        server.respondWith(data.url, [400, {}, '']);
      });
      hls.on(Events.LEVEL_LOADING, (event, data) => {
        server.respond();
      });
      return new Promise((resolve) => {
        hls.on(Events.ERROR, (event, data) => resolve(data));
        server.respond();
      }).then((data: ErrorData) => {
        expect(data.details).to.equal(ErrorDetails.LEVEL_LOAD_ERROR);
        expect(data.fatal).to.equal(false, 'Error should not be fatal');
        expect(data.error.message).to.equal(
          'A network error occurred while loading level: 1 id: 0',
          data.error.message
        );
        hls.stopLoad.should.have.been.calledOnce;
        hls.trigger.should.have.been.calledWith(Events.LEVEL_LOADED);
        expect(hls.currentLevel).to.not.equal(
          errorIndex,
          'Should not be on errored level'
        );
      });
    });

    it('Level Load Timeout Errors are not fatal when switch options are present', function () {
      hls.loadSource('multivariantPlaylist.m3u8');
      let errorIndex = -1;
      hls.once(Events.LEVEL_LOADING, (event, data) => {
        errorIndex = data.level;
      });
      return new Promise((resolve) => {
        hls.on(Events.ERROR, (event, data) => resolve(data));
        server.respond();
        clock.tick(20000);
      }).then((data: ErrorData) => {
        expect(data.details).to.equal(ErrorDetails.LEVEL_LOAD_TIMEOUT);
        expect(data.fatal).to.equal(false, 'Error should not be fatal');
        expect(data.error.message).to.equal(
          'A network timeout occurred while loading level: 1 id: 0',
          data.error.message
        );
        server.respond();
        hls.stopLoad.should.have.been.calledOnce;
        hls.trigger.should.have.been.calledWith(Events.LEVEL_LOADED);
        expect(hls.currentLevel).to.not.equal(
          errorIndex,
          'Should not be on errored level'
        );
      });
    });
  });
});

const testResponses = {
  'noEXTM3U.m3u8': '#EXT_NOT_HLS',

  'noLevels.m3u8': '#EXTM3U',

  'noCompatCodecs.m3u8': `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=100000,CODECS="avc9.000000,mp5a.40.2,av99.000000",RESOLUTION=480x270
noop.m3u8`,

  'varSubErrorMultivariantPlaylist.m3u8': `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=100000,RESOLUTION=480x270
variant{$foobar}.m3u8`,

  'multivariantPlaylist.m3u8': `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=200000,RESOLUTION=1280x720
mid.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=100000,RESOLUTION=480x270
low.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=300000,RESOLUTION=1920x1080
high.m3u8`,

  'varSubErrorMediaPlaylist.m3u8': `#EXTM3U
#EXT-X-VERSION:10
#EXT-X-TARGETDURATION:6
#EXTINF:6
segment{$foobar}.mp4`,

  'noTargetDuration.m3u8': `#EXTM3U
#EXT-X-VERSION:1
#EXTINF:6
segment.mp4`,

  'noSegmentsVod.m3u8': `#EXTM3U
#EXT-X-VERSION:1
#EXT-X-TARGETDURATION:6
#EXT-X-ENDLIST`,

  'noSegmentsLive.m3u8': `#EXTM3U
#EXT-X-VERSION:1
#EXT-X-TARGETDURATION:6`,

  'oneSegmentLive.m3u8': `#EXTM3U
#EXT-X-VERSION:1
#EXT-X-TARGETDURATION:6
#EXTINF:6
segment.mp4`,

  'oneSegmentVod.m3u8': `#EXTM3U
#EXT-X-VERSION:1
#EXT-X-TARGETDURATION:6
#EXTINF:6
segment.mp4
#EXT-X-ENDLIST`,
};

function setupMockServerResponses(server: any) {
  Object.keys(testResponses).forEach((requestUrl) => {
    server.respondWith(requestUrl, [200, {}, testResponses[requestUrl]]);
  });
  server.respondWith('multivariantPlaylist.m3u8/low.m3u8', [
    200,
    {},
    testResponses['oneSegmentVod.m3u8'],
  ]);
  server.respondWith('multivariantPlaylist.m3u8/mid.m3u8', [
    200,
    {},
    testResponses['oneSegmentVod.m3u8'],
  ]);
  server.respondWith('multivariantPlaylist.m3u8/high.m3u8', [
    200,
    {},
    testResponses['oneSegmentVod.m3u8'],
  ]);
}

function expectFatalErrorEventToStopPlayer(
  hls: Hls,
  withErrorDetails: ErrorDetails,
  withErrorMessage: string
) {
  return (data: ErrorData) => {
    expect(data.details).to.equal(withErrorDetails);
    expect(data.fatal).to.equal(true, 'Error should be fatal');
    expect(data.error.message).to.equal(withErrorMessage, data.error.message);
    expectPlayerStopped(hls);
    hls.stopLoad.should.have.been.calledTwice;
  };
}

function expectPlayerStopped(hlsPrivate: any) {
  hlsPrivate.networkControllers.forEach((controller) => {
    // All stream-controllers are stopped
    if ('state' in controller) {
      expect(controller.state, `${controller.constructor.name}.state`).to.equal(
        'STOPPED'
      );
    }
    // All loaders controllers have destroyed their loaders
    if ('loaders' in controller) {
      expect(controller.loaders, `${controller.constructor.name}.loaders`).to.be
        .empty;
    }
    // All playlist-controllers (level-, track-) have stopped loading
    if ('canLoad' in controller) {
      expect(controller.canLoad, `${controller.constructor.name}.canLoad`).to.be
        .false;
    }
  });
}
