// eslint-disable-next-line spaced-comment
/// <reference path="../src/index.d.ts" />

describe('suite', () => {
  it.todo('works');

  describe('nested', () => {
    it('should work', () => {
      // console.debug('heylooo');

      // console.log('heylooo');

      // console.warn('heylooo');

      // console.error('heylooo');

      // eslint-disable-next-line no-undef
      console.log('heylooo %i', '1.46', document.createElement('div'), [
        1,
        23,
        4,
      ]);
      expect(true).toEqual(true);
    });
  });

  it('should work 1', () => {
    const spy = karmaJest.fn();

    spy();
    karmaJest.useFakeTimers();

    let finished = false;
    setTimeout(() => {
      finished = true;
    }, 300);

    expect(true).toEqual(true);

    karmaJest.runAllTimers();

    expect(finished).toEqual(true);

    karmaJest.useRealTimers();
  });

  describe('nested 2', () => {
    it('should work 2', () => {
      // expect(true).toEqual(false);
      expect(`
      asfasffffffffffff
      `).toMatchSnapshot();
    });

    it('should work 3', () => {
      expect(true).toEqual(true);
    });
  });
});

describe('suite 3', () => {
  it('works', (done) => {
    setTimeout(() => {
      done();
    }, 1000);
  });
});

describe('different', () => {
  it('test 1', (done) => {
    setTimeout(() => {
      done();
    }, 500);
  });

  it('test 2', (done) => {
    setTimeout(() => {
      done();
    }, 2000);
  });

  it('test 3', (done) => {
    setTimeout(() => {
      done();
    }, 1000);
  });
});
