<?php

namespace Tests\Feature;

// use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    /**
     * A basic test example.
     */
    public function test_the_cyclones_endpoint_returns_a_successful_response(): void
    {
        $response = $this->getJson('/api/v1/cyclones/active');

        $response->assertStatus(200);
    }
}
