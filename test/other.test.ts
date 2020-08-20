import './styles.css';

console.log(expect.getState());
describe('typescript', () => {
  it('should compile ts', () => {
    const div = document.createElement('div');
    div.classList.add('foo');
    document.body.appendChild(div);
    console.log('HIIAISFASFASF');
    expect(true as boolean).toEqual(true);
  });
});
