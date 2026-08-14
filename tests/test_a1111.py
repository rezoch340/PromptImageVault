from backend.metadata.a1111 import parse_parameters


def test_parses_a1111_parameters_and_unknown_fields():
    result = parse_parameters(
        "cinematic portrait, warm light\n"
        "Negative prompt: blurry, low quality\n"
        "Steps: 28, Sampler: DPM++ 2M, Schedule type: Karras, CFG scale: 6.5, "
        "Seed: 4294967295, Size: 768x1024, Model: dream_v9, Custom: value"
    )

    assert result["prompt"] == "cinematic portrait, warm light"
    assert result["negative_prompt"] == "blurry, low quality"
    assert result["steps"] == 28
    assert result["sampler"] == "DPM++ 2M"
    assert result["scheduler"] == "Karras"
    assert result["cfg"] == 6.5
    assert result["seed"] == "4294967295"
    assert result["width"] == 768
    assert result["height"] == 1024
    assert result["extras"] == {"Custom": "value"}


def test_parses_prompt_without_negative_prompt():
    result = parse_parameters("a quiet forest\nSteps: 20, Seed: 7")
    assert result["prompt"] == "a quiet forest"
    assert result["negative_prompt"] == ""
    assert result["steps"] == 20
