const mix = require('laravel-mix')
const Dotenv = require('dotenv-webpack')

mix.webpackConfig({
  plugins: [new Dotenv()],
})
mix.react('./resources/assets/js/index.js', 'public/js')

if (mix.inProduction()) {
  mix.version()
}
