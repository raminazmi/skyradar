<?php

namespace App\Exceptions;

use RuntimeException;
use Throwable;

class WeatherProviderException extends RuntimeException
{
    public function __construct(
        string $message = 'Unable to fetch weather data from the upstream provider.',
        protected int $statusCode = 503,
        ?Throwable $previous = null
    ) {
        parent::__construct($message, $statusCode, $previous);
    }

    public function getStatusCode(): int
    {
        return $this->statusCode;
    }
}
