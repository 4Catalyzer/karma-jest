console.error('HOOOOO');

describe('suite', () => {
  describe('nested', () => {
    it('should work', () => {
      expect(true).toEqual(true);
    });
  });

  it('should work 1', () => {
    expect(true).toEqual(true);
  });

  describe('nested 2', () => {
    it('should work 2', () => {
      expect(true).toEqual(false);
      expect(`
      asfasffffffffffff
      `).toMatchSnapshot();
    });

    it('should work 3', () => {
      expect(true).toEqual(true);
    });
  });
});
