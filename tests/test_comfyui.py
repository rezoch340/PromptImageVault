import json

from backend.metadata.comfyui import parse_comfy


def test_extracts_basic_comfyui_workflow_fields():
    prompt = {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "flux.safetensors"}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"text": "glass sculpture"}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": "noise"}},
        "4": {
            "class_type": "KSampler",
            "inputs": {
                "seed": 123,
                "steps": 22,
                "cfg": 4.5,
                "sampler_name": "euler",
                "scheduler": "normal",
                "positive": ["2", 0],
                "negative": ["3", 0],
            },
        },
    }
    result = parse_comfy(json.dumps(prompt), json.dumps({"nodes": []}))

    assert result["prompt"] == "glass sculpture"
    assert result["negative_prompt"] == "noise"
    assert result["seed"] == 123
    assert result["steps"] == 22
    assert result["model"] == "flux.safetensors"
    assert "workflow" in result


def test_follows_conditioning_nodes_and_extracts_unet_model():
    prompt = {
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": "flux-fill.safetensors"}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"text": "extend the background"}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": "artifacts"}},
        "4": {"class_type": "FluxGuidance", "inputs": {"conditioning": ["2", 0], "guidance": 30}},
        "5": {
            "class_type": "InpaintModelConditioning",
            "inputs": {"positive": ["4", 0], "negative": ["3", 0]},
        },
        "6": {
            "class_type": "KSampler",
            "inputs": {
                "positive": ["5", 0],
                "negative": ["5", 1],
                "seed": ["7", 0],
                "steps": 20,
            },
        },
        "7": {"class_type": "Seed (rgthree)", "inputs": {"seed": 9}},
    }

    result = parse_comfy(prompt)

    assert result["prompt"] == "extend the background"
    assert result["negative_prompt"] == "artifacts"
    assert result["model"] == "flux-fill.safetensors"
    assert result["seed"] == 9
