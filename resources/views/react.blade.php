<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">

    <title>{{ config('app.name', 'Conjure') }}</title>

    <!-- Scripts -->
    <script src="{{ mix('js/index.js') }}" defer></script>
    @routes
</head>
<body>
    <div id="react-root"></div>
</body>
</html>
